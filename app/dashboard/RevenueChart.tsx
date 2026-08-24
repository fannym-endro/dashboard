"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function RevenueChart({ data, brand }: { data: any[]; brand: string }) {
  const rows = data.map((d) => ({
    date: new Date(d.date_key).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    ca: Number(d.ca_ht),
    meta: Number(d.meta_attributed_ca),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
        <Line type="monotone" dataKey="ca" stroke={brand} strokeWidth={2} dot={false} name="CA HT" />
        <Line type="monotone" dataKey="meta" stroke="#c9a227" strokeWidth={1.5} dot={false} name="CA attribué Meta" />
      </LineChart>
    </ResponsiveContainer>
  );
}
