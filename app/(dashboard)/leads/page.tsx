import { redirect } from "next/navigation";

/** Leads are a tab on the tender list. */
export default function LeadsPage() {
  redirect("/tenders?tab=leads");
}
