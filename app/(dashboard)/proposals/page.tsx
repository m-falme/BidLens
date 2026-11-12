import { redirect } from "next/navigation";

/** Bid preparation lives on the tender. This page has no list of its own. */
export default function ProposalsPage() {
  redirect("/tenders");
}
