import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import BalancePaymentClient from "./BalancePaymentClient";

export const dynamic = "force-dynamic";

export default async function BalancePaymentPage({
  params,
}: {
  params: Promise<{ moveId: string }>;
}) {
  const { moveId } = await params;
  const supabase = await createClient();

  const { data: move, error } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, scheduled_date, from_address, to_address, balance_amount, balance_paid_at, deposit_paid_at, square_customer_id, square_card_id"
    )
    .eq("id", moveId)
    .single();

  if (error || !move) notFound();

  const balanceAmount = Number(move.balance_amount || 0);
  const alreadyPaid = !!move.balance_paid_at;

  return (
    <BalancePaymentClient
      move={move}
      balanceAmount={balanceAmount}
      alreadyPaid={alreadyPaid}
    />
  );
}
