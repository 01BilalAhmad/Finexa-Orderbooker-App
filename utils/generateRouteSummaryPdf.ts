// utils/generateRouteSummaryPdf.ts
// Generates a PDF of the route summary (recovery details per shop)
// Uses expo-print (HTML → PDF) + expo-sharing (share/save)
import * as Print from 'expo-print';
import { cacheDirectory, copyAsync, deleteAsync } from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { formatPKR, getTodayLabel } from '@/utils/format';

interface RecoveryEntry {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  description?: string | null;
  gpsAddress?: string | null;
  createdAt: string;
}

interface RecoveryShop {
  shopId: string;
  shopName: string;
  shopArea: string | null;
  shopBalance: number;
  totalRecovery: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  entries: RecoveryEntry[];
}

interface SummaryData {
  sessionId: string;
  sessionStartTime: string;
  sessionEndTime: string | null;
  totalRecovery: number;
  totalPending: number;
  totalApproved: number;
  shops: RecoveryShop[];
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function generateHtml(data: SummaryData, orderbookerName: string): string {
  const { shops, totalRecovery, totalPending, totalApproved, sessionStartTime, sessionEndTime } = data;

  const shopRows = shops
    .map((shop, idx) => {
      const entryRows = shop.entries
        .map((entry) => {
          const statusColor =
            entry.status === 'approved'
              ? '#10B981'
              : entry.status === 'pending'
              ? '#F59E0B'
              : '#EF4444';
          const statusLabel = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
          return `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#6B7280;">${formatTime(entry.createdAt)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;font-size:12px;font-weight:600;color:#111827;">Rs. ${entry.amount.toLocaleString('en-PK')}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;">
                <span style="background:${statusColor}20;color:${statusColor};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">${statusLabel}</span>
              </td>
              <td style="padding:6px 8px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#6B7280;">${entry.gpsAddress || '—'}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <div style="margin-bottom:16px;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
          <div style="background:#F9FAB;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E5E7EB;">
            <div>
              <span style="font-size:14px;font-weight:700;color:#111827;">${idx + 1}. ${shop.shopName}</span>
              ${shop.shopArea ? `<span style="font-size:11px;color:#6B7280;margin-left:8px;">${shop.shopArea}</span>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:16px;font-weight:700;color:#2563EB;">Rs. ${shop.totalRecovery.toLocaleString('en-PK')}</div>
              <div style="font-size:10px;color:#6B7280;">Remaining: Rs. ${shop.shopBalance.toLocaleString('en-PK')}</div>
            </div>
          </div>
          ${shop.entries.length > 0 ? `
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#F9FAFB;">
                  <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6B7280;font-weight:600;">Time</th>
                  <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6B7280;font-weight:600;">Amount</th>
                  <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6B7280;font-weight:600;">Status</th>
                  <th style="padding:6px 8px;text-align:left;font-size:10px;color:#6B7280;font-weight:600;">GPS Location</th>
                </tr>
              </thead>
              <tbody>
                ${entryRows}
              </tbody>
            </table>
          ` : '<div style="padding:12px 16px;font-size:12px;color:#9CA3AF;">No recovery entries</div>'}
          ${shop.pendingCount > 0 || shop.approvedCount > 0 || shop.rejectedCount > 0 ? `
            <div style="padding:8px 16px;background:#F9FAFB;border-top:1px solid #E5E7EB;display:flex;gap:12px;">
              ${shop.approvedCount > 0 ? `<span style="font-size:10px;color:#10B981;font-weight:600;">✓ ${shop.approvedCount} Approved</span>` : ''}
              ${shop.pendingCount > 0 ? `<span style="font-size:10px;color:#F59E0B;font-weight:600;">⏳ ${shop.pendingCount} Pending</span>` : ''}
              ${shop.rejectedCount > 0 ? `<span style="font-size:10px;color:#EF4444;font-weight:600;">✗ ${shop.rejectedCount} Rejected</span>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #FFFFFF; color: #111827; }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#2563EB,#3B82F6);color:white;padding:12px 32px;border-radius:12px;font-size:20px;font-weight:700;margin-bottom:8px;">
          Route Summary
        </div>
        <div style="font-size:14px;color:#6B7280;">${getTodayLabel()}</div>
        <div style="font-size:12px;color:#9CA3AF;margin-top:4px;">Orderbooker: ${orderbookerName}</div>
      </div>

      <!-- Summary Cards -->
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#DBEAFE;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#6B7280;margin-bottom:4px;">Total Recovery</div>
          <div style="font-size:20px;font-weight:700;color:#2563EB;">Rs. ${totalRecovery.toLocaleString('en-PK')}</div>
        </div>
        <div style="flex:1;background:#FEF3C7;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#92400E;margin-bottom:4px;">Pending</div>
          <div style="font-size:20px;font-weight:700;color:#92400E;">Rs. ${totalPending.toLocaleString('en-PK')}</div>
        </div>
        <div style="flex:1;background:#D1FAE5;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#065F46;margin-bottom:4px;">Approved</div>
          <div style="font-size:20px;font-weight:700;color:#065F46;">Rs. ${totalApproved.toLocaleString('en-PK')}</div>
        </div>
        <div style="flex:1;background:#FEE2E2;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#991B1B;margin-bottom:4px;">Shops</div>
          <div style="font-size:20px;font-weight:700;color:#991B1B;">${shops.length}</div>
        </div>
      </div>

      <!-- Session Info -->
      <div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#6B7280;">
        <strong>Route Start:</strong> ${formatTime(sessionStartTime)} | 
        <strong>Route End:</strong> ${sessionEndTime ? formatTime(sessionEndTime) : '—'}
      </div>

      <!-- Shop Details -->
      <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:12px;">Shop-wise Recovery Details</div>
      ${shopRows}

      <!-- Footer -->
      <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;">
        <div style="font-size:11px;color:#9CA3AF;">Generated by Finexa Recovery App</div>
        <div style="font-size:10px;color:#D1D5DB;margin-top:4px;">© 2026 Finexa. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
}

export async function generateRouteSummaryPdf(
  data: SummaryData,
  orderbookerName: string
): Promise<void> {
  try {
    const html = generateHtml(data, orderbookerName);

    const { uri } = await Print.printToFileAsync({ html });

    // Save to a shareable location
    const filename = `Route_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
    const destUri = (cacheDirectory || '') + filename;

    // Copy to cache directory (shareable)
    await copyAsync({
      from: uri,
      to: destUri,
    });

    // Share / Save dialog
    await shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Route Summary PDF',
      UTI: 'com.adobe.pdf',
    });

    // Clean up temp file
    try {
      await deleteAsync(uri, { idempotent: true });
    } catch {}
  } catch (error: any) {
    console.error('[RouteSummary PDF] Error:', error);
    Alert.alert('PDF Error', error?.message || 'Failed to generate PDF. Please try again.');
  }
}
