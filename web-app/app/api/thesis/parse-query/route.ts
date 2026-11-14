import { parseNaturalQuery } from '@verithesis/enclave-worker';
import { getParseApiMessages } from '@/lib/i18n/catalog';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales';

const MAX_QUERY_LEN = 500;

export async function POST(req: Request) {
  let body: { query?: unknown; locale?: unknown } = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === 'object') body = parsed as typeof body;
  } catch {
    /* fall through: treated as empty query */
  }
  const locale: Locale = typeof body.locale === 'string' && isLocale(body.locale) ? body.locale : DEFAULT_LOCALE;
  const msgs = getParseApiMessages(locale);

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return Response.json({ error: msgs.queryRequired }, { status: 400 });
  }
  const params = parseNaturalQuery(query.slice(0, MAX_QUERY_LEN));
  const reply =
    Object.keys(params).length > 0
      ? msgs.parsed.replace('{params}', JSON.stringify(params))
      : msgs.empty;
  return Response.json({ params, reply, locale });
}
