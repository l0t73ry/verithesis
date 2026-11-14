//! VeriThesis WASI analyzer — must match `enclave-worker/src/hash.ts` + `analyzer.ts`.
//! P2 HTTP fetch URLs: `enclave-worker/src/data-sources.ts` — see `outlayer/P2-HTTP-PORT.md`.

use serde::ser::SerializeStruct;
use serde::{Deserialize, Serialize, Serializer};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::{self, Read, Write};

#[derive(Debug, Deserialize)]
struct ThesisInput {
    timeframe: String,
    target_token: String,
    #[serde(default)]
    smoothing_window: Option<f64>,
    #[serde(default)]
    strategy_mode: Option<String>,
    #[serde(default)]
    realtime_unlocked: Option<bool>,
    #[serde(default)]
    tvl_weight: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
struct ThesisFactors {
    github_commits_7d: f64,
    funding_rate_bps: f64,
    whale_net_flow_musd: f64,
}

#[derive(Debug, Clone, Deserialize)]
struct SeriesPoint {
    date: String,
    price_usd: f64,
    defi_tvl_usd: f64,
}

#[derive(Debug)]
struct ThesisConclusion {
    signal: String,
    pearson_r: f64,
    r_squared: f64,
    backtest_hit_rate: f64,
    tvl_weight: f64,
    github_commits_7d: f64,
    funding_rate_bps: f64,
    whale_net_flow_musd: f64,
    sharpe_ratio: f64,
    max_drawdown_pct: f64,
    strategy_return_pct: f64,
    buy_hold_return_pct: f64,
    headline: String,
    summary: String,
}

fn ecma_number(f: f64) -> serde_json::Value {
    if (f - f.round()).abs() < 1e-9 && f.abs() < 9_007_199_254_740_992.0 {
        serde_json::json!(f.round() as i64)
    } else {
        serde_json::Number::from_f64(f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::json!(0))
    }
}

impl Serialize for SeriesPoint {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut st = serializer.serialize_struct("SeriesPoint", 3)?;
        st.serialize_field("date", &self.date)?;
        st.serialize_field("defi_tvl_usd", &ecma_number(self.defi_tvl_usd))?;
        st.serialize_field("price_usd", &ecma_number(self.price_usd))?;
        st.end()
    }
}

impl Serialize for ThesisConclusion {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut st = serializer.serialize_struct("ThesisConclusion", 14)?;
        st.serialize_field("backtest_hit_rate", &ecma_number(self.backtest_hit_rate))?;
        st.serialize_field("buy_hold_return_pct", &ecma_number(self.buy_hold_return_pct))?;
        st.serialize_field("funding_rate_bps", &ecma_number(self.funding_rate_bps))?;
        st.serialize_field("github_commits_7d", &ecma_number(self.github_commits_7d))?;
        st.serialize_field("headline", &self.headline)?;
        st.serialize_field("max_drawdown_pct", &ecma_number(self.max_drawdown_pct))?;
        st.serialize_field("pearson_r", &ecma_number(self.pearson_r))?;
        st.serialize_field("r_squared", &ecma_number(self.r_squared))?;
        st.serialize_field("sharpe_ratio", &ecma_number(self.sharpe_ratio))?;
        st.serialize_field("signal", &self.signal)?;
        st.serialize_field("strategy_return_pct", &ecma_number(self.strategy_return_pct))?;
        st.serialize_field("summary", &self.summary)?;
        st.serialize_field("tvl_weight", &ecma_number(self.tvl_weight))?;
        st.serialize_field("whale_net_flow_musd", &ecma_number(self.whale_net_flow_musd))?;
        st.end()
    }
}

#[derive(Debug, Deserialize)]
struct WasmPayload {
    input: ThesisInput,
    series: Vec<SeriesPoint>,
    #[serde(default)]
    sealed_bias: Option<f64>,
    #[serde(default)]
    factors: Option<ThesisFactors>,
}

#[derive(Debug, Serialize)]
struct WasmOutput {
    enclave: &'static str,
    version: &'static str,
    input_hash: String,
    output_hash: String,
    conclusion: ThesisConclusion,
    series_lagged: bool,
    display_series_len: usize,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut buf = String::new();
    io::stdin().read_to_string(&mut buf)?;
    let payload: WasmPayload = serde_json::from_str(buf.trim())?;
    if payload.series.len() < 3 {
        return Err("series.len() < 3".into());
    }
    let sealed_bias = payload.sealed_bias.unwrap_or(0.08);
    let factors = payload.factors.clone().unwrap_or(ThesisFactors {
        github_commits_7d: 0.0,
        funding_rate_bps: 0.0,
        whale_net_flow_musd: 0.0,
    });
    let out = analyze(&payload.input, &payload.series, sealed_bias, &factors)?;
    let line = serde_json::to_string(&out)?;
    print!("{line}");
    io::stdout().flush()?;
    Ok(())
}

fn normalize_tvl_weight(w: Option<f64>) -> f64 {
    let x = w.unwrap_or(0.5);
    let clamped = x.max(0.2).min(0.8);
    (clamped * 1000.0).round() / 1000.0
}

fn analyze(
    input: &ThesisInput,
    series: &[SeriesPoint],
    sealed_bias: f64,
    factors: &ThesisFactors,
) -> Result<WasmOutput, Box<dyn std::error::Error>> {
    let window = input.smoothing_window.unwrap_or(1.0);
    let mode = input.strategy_mode.as_deref().unwrap_or("public");
    let token = &input.target_token;
    let tvl_weight = normalize_tvl_weight(input.tvl_weight);

    let prices: Vec<f64> = series.iter().map(|s| s.price_usd).collect();
    let tvls: Vec<f64> = series.iter().map(|s| s.defi_tvl_usd).collect();
    let price_sm = smooth(&prices, window);
    let tvl_sm = smooth(&tvls, window);
    let r = weighted_composite_r(&price_sm, &tvl_sm, tvl_weight);
    let conclusion = build_conclusion(series, r, token, mode, sealed_bias, factors, tvl_weight);

    let unlocked = input.realtime_unlocked.unwrap_or(false);
    let (display_series, lagged) = apply_realtime_lag(series, unlocked);

    let input_hash = hash_thesis_input(input);
    let output_hash = hash_output(&display_series, &conclusion);
    Ok(WasmOutput {
        enclave: "verithesis-wasi",
        version: "0.3.0",
        input_hash,
        output_hash,
        conclusion,
        series_lagged: lagged,
        display_series_len: display_series.len(),
    })
}

fn stable_stringify(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => {
            if *b {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        Value::Number(n) => number_to_ecma_json(n),
        Value::String(s) => serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string()),
        Value::Array(arr) => {
            let inner: Vec<String> = arr.iter().map(stable_stringify).collect();
            format!("[{}]", inner.join(","))
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let parts: Vec<String> = keys
                .iter()
                .map(|k| {
                    let key_json = serde_json::to_string(k).unwrap();
                    let val = stable_stringify(&map[*k]);
                    format!("{key_json}:{val}")
                })
                .collect();
            format!("{{{}}}", parts.join(","))
        }
    }
}

/// Match `JSON.stringify` for numeric primitives in stable hash payloads.
fn number_to_ecma_json(n: &serde_json::Number) -> String {
    serde_json::Value::Number(n.clone()).to_string()
}

fn sha256_hex(payload: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hash_thesis_input(input: &ThesisInput) -> String {
    let body = json!({
        "realtime_unlocked": input.realtime_unlocked.unwrap_or(false),
        "smoothing_window": normalize_json_number(input.smoothing_window.unwrap_or(1.0)),
        "strategy_mode": input.strategy_mode.as_deref().unwrap_or("public"),
        "target_token": input.target_token,
        "timeframe": input.timeframe,
        "tvl_weight": normalize_json_number(normalize_tvl_weight(input.tvl_weight)),
    });
    sha256_hex(&stable_stringify(&body))
}

fn hash_output(series: &[SeriesPoint], conclusion: &ThesisConclusion) -> String {
    let series_val = serde_json::to_value(series).expect("series json");
    let conclusion_val = serde_json::to_value(conclusion).expect("conclusion json");
    let body = json!({
        "conclusion": conclusion_val,
        "series": series_val,
    });
    sha256_hex(&stable_stringify(&body))
}

/// Match JSON.stringify for smoothing_window integers (1 not 1.0 when whole).
fn normalize_json_number(n: f64) -> Value {
    if (n - n.round()).abs() < 1e-9 {
        json!(n.round() as i64)
    } else {
        json!(n)
    }
}

fn smooth(values: &[f64], window: f64) -> Vec<f64> {
    let mut w = window.round() as i32;
    w = w.max(1).min(14);
    if w <= 1 {
        return values.to_vec();
    }
    values
        .iter()
        .enumerate()
        .map(|(i, _)| {
            let start = (i as i32 - w + 1).max(0) as usize;
            let slice = &values[start..=i];
            slice.iter().sum::<f64>() / slice.len() as f64
        })
        .collect()
}

fn pct_change(series: &[f64]) -> Vec<f64> {
    let mut out = Vec::new();
    for i in 1..series.len() {
        let prev = series[i - 1];
        if prev == 0.0 {
            out.push(0.0);
        } else {
            out.push((series[i] - prev) / prev);
        }
    }
    out
}

fn pearson(xs: &[f64], ys: &[f64]) -> f64 {
    let n = xs.len().min(ys.len());
    if n < 3 {
        return 0.0;
    }
    let x = &xs[..n];
    let y = &ys[..n];
    let mx: f64 = x.iter().sum::<f64>() / n as f64;
    let my: f64 = y.iter().sum::<f64>() / n as f64;
    let mut num = 0.0;
    let mut dx = 0.0;
    let mut dy = 0.0;
    for i in 0..n {
        let a = x[i] - mx;
        let b = y[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    let den = (dx * dy).sqrt();
    if den == 0.0 {
        0.0
    } else {
        num / den
    }
}

fn backtest_hit_rate(series: &[SeriesPoint]) -> f64 {
    let mut hits = 0;
    let mut trials = 0;
    for i in 1..series.len() {
        let dp = series[i].price_usd - series[i - 1].price_usd;
        let dt = series[i].defi_tvl_usd - series[i - 1].defi_tvl_usd;
        if dp == 0.0 && dt == 0.0 {
            continue;
        }
        trials += 1;
        if (dp > 0.0 && dt > 0.0) || (dp < 0.0 && dt < 0.0) {
            hits += 1;
        }
    }
    if trials == 0 {
        0.0
    } else {
        ((hits as f64 / trials as f64) * 1000.0).round() / 10.0
    }
}

fn apply_sealed_bias(r: f64, mode: &str, sealed_bias: f64) -> f64 {
    if mode != "sealed" {
        return r;
    }
    r + sealed_bias
}

fn weighted_composite_r(price_sm: &[f64], tvl_sm: &[f64], tvl_weight: f64) -> f64 {
    let w_tvl = tvl_weight;
    let w_mom = 1.0 - w_tvl;
    let price_ch = pct_change(price_sm);
    let tvl_ch = pct_change(tvl_sm);
    let r_tvl = pearson(&price_ch, &tvl_ch);
    let r_mom = if price_ch.len() > 2 {
        pearson(&price_ch[1..], &price_ch[..price_ch.len() - 1])
    } else {
        0.0
    };
    w_tvl * r_tvl + w_mom * r_mom
}

fn sharpe_ratio(daily_returns: &[f64]) -> f64 {
    if daily_returns.len() < 2 {
        return 0.0;
    }
    let n = daily_returns.len() as f64;
    let mean = daily_returns.iter().sum::<f64>() / n;
    let variance = daily_returns.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0);
    let std = variance.sqrt();
    if std == 0.0 {
        return 0.0;
    }
    let sharpe = (mean / std) * (252f64).sqrt();
    (sharpe * 1000.0).round() / 1000.0
}

fn max_drawdown_pct(equity: &[f64]) -> f64 {
    if equity.len() < 2 {
        return 0.0;
    }
    let mut peak = equity[0];
    let mut mdd = 0.0;
    for &v in equity {
        if v > peak {
            peak = v;
        }
        let dd = if peak > 0.0 { (peak - v) / peak } else { 0.0 };
        if dd > mdd {
            mdd = dd;
        }
    }
    (mdd * 1000.0).round() / 10.0
}

fn total_return_pct(daily_returns: &[f64]) -> f64 {
    let mut eq = 1.0;
    for r in daily_returns {
        eq *= 1.0 + r;
    }
    ((eq - 1.0) * 1000.0).round() / 10.0
}

fn backtest_weighted_strategy(
    series: &[SeriesPoint],
    tvl_weight: f64,
) -> (f64, f64, f64) {
    let w_tvl = tvl_weight.max(0.2).min(0.8);
    let w_mom = 1.0 - w_tvl;
    let mut strat: Vec<f64> = Vec::new();
    for i in 1..series.len() {
        let dp = series[i].price_usd - series[i - 1].price_usd;
        let dt = series[i].defi_tvl_usd - series[i - 1].defi_tvl_usd;
        let score = w_tvl * dt + w_mom * dp;
        let pos = if score > 0.0 {
            1.0
        } else if score < 0.0 {
            -1.0
        } else {
            0.0
        };
        let prev = series[i - 1].price_usd;
        let price_ret = if prev != 0.0 {
            (series[i].price_usd - prev) / prev
        } else {
            0.0
        };
        strat.push(pos * price_ret);
    }
    let mut eq = vec![1.0];
    for r in &strat {
        eq.push(eq.last().copied().unwrap_or(1.0) * (1.0 + r));
    }
    (
        sharpe_ratio(&strat),
        max_drawdown_pct(&eq),
        total_return_pct(&strat),
    )
}

fn buy_and_hold_return_pct(series: &[SeriesPoint]) -> f64 {
  let prices: Vec<f64> = series.iter().map(|s| s.price_usd).collect();
  total_return_pct(&pct_change(&prices))
}

fn build_conclusion(
    series: &[SeriesPoint],
    r: f64,
    token: &str,
    mode: &str,
    sealed_bias: f64,
    factors: &ThesisFactors,
    tvl_weight: f64,
) -> ThesisConclusion {
    let r_adj = apply_sealed_bias(r, mode, sealed_bias);
    let r2 = (r_adj * r_adj * 1000.0).round() / 1000.0;
    let hit = backtest_hit_rate(series);
    let (sharpe, mdd, strat_ret) = backtest_weighted_strategy(series, tvl_weight);
    let buy_hold = buy_and_hold_return_pct(series);
    let price_chg = pct_change(&series.iter().map(|s| s.price_usd).collect::<Vec<_>>());
    let recent_mom: f64 = price_chg.iter().rev().take(3).sum();
    let mut signal = if r_adj > 0.25 && recent_mom > 0.0 {
        "bullish".to_string()
    } else if r_adj < -0.15 || recent_mom < -0.05 {
        "bearish".to_string()
    } else {
        "neutral".to_string()
    };

    if signal == "bullish" {
        if factors.github_commits_7d < 12.0 {
            signal = "neutral".to_string();
        }
        if factors.funding_rate_bps > 12.0 {
            signal = "neutral".to_string();
        }
        if factors.whale_net_flow_musd < -2.0 {
            signal = "neutral".to_string();
        }
    }

    let mode_note = if mode == "sealed" {
        " (Sealed Alpha — weights in TEE only)"
    } else {
        ""
    };

    let headline = match signal.as_str() {
        "bullish" => format!("{token} multi-factor edge: TVL/momentum + dev activity{mode_note}"),
        "bearish" => format!("{token} diverges from NEAR DeFi TVL composite{mode_note}"),
        _ => format!("{token} vs NEAR DeFi TVL: no strong edge in window{mode_note}"),
    };

    let summary = format!(
        "Pearson composite={:.3} (w_tvl={tvl_weight}), R²={:.3}; Sharpe={:.2}, MDD={mdd:.1}%; strategy {strat_ret:.1}% vs B&H {buy_hold:.1}%; factors: gh7d={}, funding={}bps, whale≈{}M. Not financial advice.",
        r_adj,
        r2,
        sharpe,
        factors.github_commits_7d,
        factors.funding_rate_bps,
        factors.whale_net_flow_musd
    );

    ThesisConclusion {
        signal,
        pearson_r: (r_adj * 1000.0).round() / 1000.0,
        r_squared: r2,
        backtest_hit_rate: hit,
        tvl_weight,
        github_commits_7d: factors.github_commits_7d,
        funding_rate_bps: factors.funding_rate_bps,
        whale_net_flow_musd: factors.whale_net_flow_musd,
        sharpe_ratio: sharpe,
        max_drawdown_pct: mdd,
        strategy_return_pct: strat_ret,
        buy_hold_return_pct: buy_hold,
        headline,
        summary,
    }
}

fn apply_realtime_lag(series: &[SeriesPoint], unlocked: bool) -> (Vec<SeriesPoint>, bool) {
    if unlocked || series.len() <= 1 {
        return (series.to_vec(), false);
    }
    (series[..series.len() - 1].to_vec(), true)
}
