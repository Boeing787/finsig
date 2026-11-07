import { z } from 'zod';
import { reportingRecordSchema, type ReportingRecord } from '../domain/reporting';

const baseUrl = 'https://api-m.sandbox.paypal.com';
const pageSchema = z.object({
  transaction_details: z.array(reportingRecordSchema).optional(),
  total_pages: z.number().int().nonnegative().optional(),
  last_refreshed_datetime: z.string().optional(),
});

export interface ReportingPage {
  records: ReportingRecord[];
  totalPages: number;
  refreshedAt: Date | null;
}

async function jsonOrError(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = z
      .object({ name: z.string().optional(), debug_id: z.string().optional() })
      .safeParse(body);
    throw new Error(
      `PayPal HTTP ${response.status}: ${error.success ? (error.data.name ?? 'UNKNOWN') : 'UNKNOWN'}${error.success && error.data.debug_id ? ` (${error.data.debug_id})` : ''}`,
    );
  }
  return body;
}

export class PayPalReportingClient {
  private async accessToken(): Promise<string> {
    const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Missing PayPal sandbox credentials.');
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000),
    });
    const token = z
      .object({ access_token: z.string(), scope: z.string() })
      .parse(await jsonOrError(response));
    if (!token.scope.split(' ').includes('https://uri.paypal.com/services/reporting/search/read')) {
      throw new Error('PayPal token has no Transaction Search scope.');
    }
    return token.access_token;
  }

  async *pages(start: Date, end: Date): AsyncGenerator<ReportingPage> {
    const interval = end.getTime() - start.getTime();
    if (interval <= 0 || interval > 31 * 86_400_000) {
      throw new Error('Reporting interval must be positive and at most 31 days.');
    }
    const token = await this.accessToken();
    let page = 1;
    let totalPages = 1;
    do {
      if (page > 100) throw new Error('Reporting pagination exceeded 100 pages.');
      const url = new URL('/v1/reporting/transactions', baseUrl);
      url.searchParams.set('start_date', start.toISOString());
      url.searchParams.set('end_date', end.toISOString());
      url.searchParams.set('fields', 'all');
      url.searchParams.set('balance_affecting_records_only', 'N');
      url.searchParams.set('page_size', '500');
      url.searchParams.set('page', String(page));
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'PayPal-Enforce-ISO8601-Format': 'true',
        },
        signal: AbortSignal.timeout(20_000),
      });
      const data = pageSchema.parse(await jsonOrError(response));
      totalPages = data.total_pages ?? 1;
      const refreshedAt = data.last_refreshed_datetime
        ? new Date(data.last_refreshed_datetime)
        : null;
      yield { records: data.transaction_details ?? [], totalPages, refreshedAt };
      page += 1;
    } while (page <= totalPages);
  }
}
