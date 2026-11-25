# BidLens Tenders: demo guide for Zanari Analytics

## What BidLens does

BidLens helps a company like Zanari decide whether to bid on a public tender. You upload the tender PDF. BidLens reads it and pulls out the key facts, each with the page and the exact quote. It checks the requirements against your company profile and your evidence. It shows what a late payment from the county could do to your profit. It then suggests one of four next steps and builds a bid preparation plan. A named person approves every decision. BidLens never submits a bid, sends an email or contacts a buyer.

The rule behind everything: **the AI reads, the code decides, a named person approves.**

## Before you start

- Deploy the latest commit, and open the live site.
- Sign out, so you can start at the sign-in page.
- Have a small PDF, PNG or JPG ready to stand in for the bid bond (up to 10 MB).
- Check `/evidence`: the paper "Bid security of KSh 250,000 in a valid bank guarantee." must be **Don't have**, with no file.
- Check Kijani's plan: "Bid security paid" must be **unticked**.
- Check Settings: the loan rate currently saved is 12%. The default is 16%. Pick the one you want to show.
- Open the tab on your own machine. Do not start a second server.

## The 5-minute script

The demo tender is **Kijani County, Digital Service Desk and Records Management System**. It is the only open tender. It closes on 30 November 2026 at 11:00.

### 1. Sign in (15 seconds)
Open `/enter`. Press **Sign in as Zanari Analytics**.
- **Shows:** one workspace, ready to use.
- **Why it matters:** your people start in their own workspace, not a blank tool.

### 2. Overview (40 seconds)
- **Shows:** active tenders, tenders waiting for a decision, documents marked Have with how many have a file, the next deadline, and "Your next actions" with a "Closes in 4 days" alert.
- **Why it matters:** a missed date can disqualify a bid, and this is the first thing a bid manager sees each morning.

Point at "Documents marked Have". Say: "Marked Have is your team's word. A file is stored proof. BidLens keeps the two apart."

### 3. Company profile (30 seconds)
- **Shows:** your registered name (editable), and the services, tools and sectors tenders are checked against. Green items come from your profile document. Dashed items were added by your team.
- **Why it matters:** BidLens compares each tender with what you say you do. Anything your team adds is clearly marked as a claim, not a fact.

Add one service live, for example "Drone survey mapping". Say: "It shows as a claim until someone checks it."

### 4. Evidence library (50 seconds)
Find **Bid security of KSh 250,000 in a valid bank guarantee.** Press **Upload file** and choose your file.
- **Shows:** every paper a tender can ask for, marked Have, Don't have or Expired, with an upload button for each.
- **Why it matters:** a requirement counts as met only when it links to a paper you hold. A paper named after one tender's bond never counts for another tender.

After the upload the row reads **Have · file uploaded**. Say: "BidLens stores the file. It does not read it, so a person still checks it."

### 5. Kijani tender, five stages (90 seconds)
Open **Tenders**, then Kijani (it is first, under "Open for bids"). Walk through the stages.

1. **Interpretation.**
   - **Shows:** the key facts with page and quote. Closing is 30 November at 11:00. Bid security is KSh 250,000. Payment is in 60 days with no advance.
   - Two facts are blank in the document: the performance security and the late-payment interest. They become questions for the buyer.
   - **Why it matters:** you see what the tender says and where it says it.
2. **Compliance.**
   - **Shows:** five registration papers met. Four read "Claimed, not verified". Tax compliance reads "File uploaded". The bid bond is now met too, using the file you just uploaded.
   - The gap is the audited accounts for 2024 and 2025. One line is unclear: two completed ICT contracts, because the profile names no clients. Four forms are still to prepare.
   - **Why it matters:** a public notice is not proof you qualify. Code compares it with your evidence and shows the real gaps.
3. **Commercial.**
   - **Shows:** the county's payment-risk band (Nairobi, Severe), and the table **What if payment is delayed**.
   - **Why it matters:** a county that pays late can erase your profit.
4. **Recommendation.**
   - **Shows:** "Consider declining", with the reasons. Audited accounts cannot be produced in four days. A person overrode this to "Proceed to preparation", and the reason is recorded.
   - **Why it matters:** the system suggests. A named person decides, and the earlier suggestion is never erased.
5. **Bid preparation.**
   - **Shows:** what to get, what to ask the buyer, what to prepare, and the key dates, each with an owner and due date.
   - **Why it matters:** the tender becomes a checklist the team can work through.

The delay table, with the figures entered for this tender (contract KSh 12,500,000, delivery cost KSh 10,625,000):

| If payment is late by | Profit at 12% loan rate | Profit at 16% loan rate |
|---|---|---|
| On time | KSh 1,875,000 (15.0%) | KSh 1,875,000 (15.0%) |
| 2 months (60 days) | KSh 1,665,411 (13.3%) | KSh 1,595,548 (12.8%) |
| 6 months (180 days) | KSh 1,246,233 (10.0%) | KSh 1,036,644 (8.3%) |
| 12 months (365 days) | KSh 600,000 (4.8%) | KSh 175,000 (1.4%) |
| 24 months (730 days) | **KSh -675,000 (-5.4%)** | **KSh -1,525,000 (-12.2%)** |

Say: "These are scenarios, not a prediction. The contract value and cost are figures the team entered. They are assumptions for this walkthrough."

### 6. Tick "Bid security paid" (30 seconds)
Open Bid preparation. The row "Bid security paid" is now unlocked, because the bond is held. Tick it.
- **Shows:** progress moves, for example "1 of 20 done". The total can differ by one, because the bond row leaves the list once the bond is held.
- **Why it matters:** the team records real progress, and it is visible without opening the tender.

### 7. Tenders list (30 seconds)
Open **Tenders**.
- **Shows:** Kijani under "Open for bids", with the pill **Preparing · 1 of 20** and the label **Bid security paid ✓**. The other tenders are under "Closed".
- **Why it matters:** the list shows what is still open and how far each bid has got.

### 8. Decision trail (30 seconds)
Open **Decision trail**. Each tender is one row, collapsed. Open Kijani.
- **Shows:** the latest decision, the number of entries and the last activity date. Expanded, it lists every review and decision with who did it and when.
- **Why it matters:** you can show who decided what, and when. Rows can never be edited or removed.

### 9. Settings (30 seconds)
- **Shows:** a loan rate, one review rule you can switch on, automatic analysis, and two on-screen alerts. Three rules are locked on.
- AI and data are shown, not editable. "Local model: coming soon".
- **Why it matters:** the company sets its own assumptions and rules. The human review rules cannot be turned off.

### 10. Sign out (5 seconds)
Press **Sign out** at the bottom of the sidebar. You land on the sign-in page.

## Five likely questions

**1. Is our data kept locally?**
Not yet. Tender files and records are stored in a cloud database, and the AI that reads a tender runs on Google Gemini today. The AI is a setting, not hard-wired. It can be swapped to a local model such as Ollama for an on-premise setup. That local option is not built yet. It shows as "coming soon" in Settings.

**2. Can it submit a bid or email a buyer?**
No. It never submits a bid, sends an email or contacts a buyer. A named person approves each stage and records the decision. "Print plan" gives you a paper checklist.

**3. How do we know the AI read the tender correctly?**
Every fact carries the page and the exact quote. Code, not the AI, checks the quote is on that page. If it is not found, the fact is marked "needs a person". The AI also never decides the recommendation. Fixed rules do. It can still miss things. Those show as "needs a person", and a correction screen is not built yet.

**4. Will it tell us when the county will pay?**
No. It shows scenarios at 2, 6, 12 and 24 months. It uses the Controller of Budget figures as at 30 June 2026, with a confidence label. The loan rate comes from your Settings. Contract value and delivery cost are entered by your team.

**5. Who can see our data, and can several companies use it?**
Today it is one workspace with a simple sign-in button. There are no passwords yet. Real sign-in and separate data for each company are planned and not built. Reviewer names are typed by the person approving.

## Keep in mind on stage

- All five other tenders have closed. Only Kijani is open. Stay on Kijani.
- Kijani is a short sample tender prepared for this walkthrough. The source file name says "Demo". Say so if asked. The other tenders are real public documents.
- Some facts on other tenders show "needs a person", for example the buyer on one tender. Avoid opening those unless asked.
- The contract values and costs on every tender are assumptions. Say so.
