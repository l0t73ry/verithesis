import { parseNaturalQuery } from '@verithesis/enclave-worker';
import { getParseApiMessages } from '@/lib/i18n/catalog';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales';

export async function POST(req: Request) {
  const body = (await req.json()) as { query?: string; locale?: string };
  const locale: Locale = body.locale && isLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  const msgs = getParseApiMessages(locale);

  if (!body.query?.trim()) {
    return Response.json({ error: msgs.queryRequired }, { status: 400 });
  }
  const params = parseNaturalQuery(body.query);
  const reply =
    Object.keys(params).length > 0
      ? msgs.parsed.replace('{params}', JSON.stringify(params))
      : msgs.empty;
  return Response.json({ params, reply, locale });
}
