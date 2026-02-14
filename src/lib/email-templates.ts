export function deliveryNotificationEmail(delivery: {
  delivery_number: string;
  customer_name: string;
  delivery_address: string;
  scheduled_date: string;
  delivery_window: string;
  status: string;
}) {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:500px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:32px;border-radius:12px">
      <div style="font-family:serif;font-size:18px;letter-spacing:2px;margin-bottom:4px">YUGO</div>
      <div style="font-size:8px;font-weight:700;color:#C9A962;letter-spacing:1px;margin-bottom:24px">DELIVERY UPDATE</div>
      
      <div style="font-size:14px;font-weight:600;margin-bottom:16px">${delivery.delivery_number} — ${delivery.customer_name}</div>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:4px">Status</div>
        <div style="font-size:13px;font-weight:600;color:#C9A962">${delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1).replace("-", " ")}</div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:12px">
          <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700">Delivery To</div>
          <div style="font-size:11px;margin-top:4px">${delivery.delivery_address}</div>
        </div>
        <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:12px">
          <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700">Window</div>
          <div style="font-size:11px;margin-top:4px">${delivery.scheduled_date} • ${delivery.delivery_window}</div>
        </div>
      </div>
      
      <div style="font-size:10px;color:#666;text-align:center;margin-top:24px">
        Yugo Premium Logistics • Toronto
      </div>
    </div>
  `;
}

export function invoiceEmail(invoice: {
  invoice_number: string;
  client_name: string;
  amount: number;
  due_date: string;
}) {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:500px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:32px;border-radius:12px">
      <div style="font-family:serif;font-size:18px;letter-spacing:2px;margin-bottom:4px">YUGO</div>
      <div style="font-size:8px;font-weight:700;color:#C9A962;letter-spacing:1px;margin-bottom:24px">INVOICE</div>
      
      <div style="font-size:14px;font-weight:600;margin-bottom:16px">${invoice.invoice_number}</div>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:20px;text-align:center;margin-bottom:16px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:8px">Amount Due</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">$${invoice.amount.toLocaleString()}</div>
        <div style="font-size:10px;color:#666;margin-top:4px">Due: ${invoice.due_date}</div>
      </div>
      
      <div style="font-size:10px;color:#666;text-align:center">
        Yugo Premium Logistics • Toronto
      </div>
    </div>
  `;
}

export function welcomeEmail(client: { name: string; email: string; portalUrl: string }) {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:500px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:32px;border-radius:12px">
      <div style="font-family:serif;font-size:18px;letter-spacing:2px;margin-bottom:4px">YUGO</div>
      <div style="font-size:8px;font-weight:700;color:#C9A962;letter-spacing:1px;margin-bottom:24px">WELCOME</div>
      
      <div style="font-size:14px;font-weight:600;margin-bottom:8px">Welcome to Yugo, ${client.name}</div>
      <div style="font-size:12px;color:#999;line-height:1.6;margin-bottom:20px">
        Your partner portal is ready. Track deliveries, view invoices, and communicate with our team — all in one place.
      </div>
      
      <a href="${client.portalUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:10px 24px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">
        Access Your Portal
      </a>
      
      <div style="font-size:10px;color:#666;text-align:center;margin-top:24px">
        Yugo Premium Logistics • Toronto
      </div>
    </div>
  `;
}