# SAR Narrative Library — Product Specification

**Type**: Free public resource / lead generation tool  
**Integration**: Econofi HubSpot website  
**Primary audience**: BSA Officers at MDIs, minority credit unions, and community banks under $1B  
**Secondary audience**: BSA consultants, compliance attorneys, bank examiners (awareness)  
**Status**: Concept — pre-build  
**Date**: April 29, 2026  

---

## What It Is

A free, searchable library of SAR narrative templates organized by suspicious activity
pattern type. Each template is a professionally written, regulatory-cited, ready-to-adapt
narrative in the format FinCEN requires. BSA Officers use them as starting points —
copy, customize with institution-specific transaction detail, file.

The library is not a product pitch. It is a compliance reference tool that happens to
demonstrate exactly what Econofi's TransactionMonitor NarrativeWriter produces.

---

## The Core Insight

BSA Officers write SAR narratives alone, under time pressure, with no standardized
template provided by FinCEN beyond the form instructions. Most recycle old narratives
or start from scratch. The quality varies widely. Poorly written narratives — vague
language, missing regulatory citations, incomplete pattern description — create exam
friction when the examiner reviews the SAR file.

A free, high-quality, pattern-specific template library solves a real daily problem.
BSA Officers bookmark tools they use repeatedly. Every visit is a brand impression
with the exact person who buys TransactionMonitor.

The MDI-specific callout on each template — explaining how the pattern manifests
differently in a cash-primary, underbanked community context — is the differentiator
that no FinCEN guidance document, FFIEC manual, or competitor provides. It is also
a direct demonstration of Econofi's core thesis.

---

## User Experience

### Primary User: BSA Officer

**Profile**: One person at a community institution responsible for all BSA/AML compliance.
Time-pressed. Compliance-oriented. Not a consumer UX person — accustomed to regulatory
forms, exam manuals, and FinCEN guidance documents. Trusts sources that cite statutes.
Distrusts vendors who lead with product features.

**Job to be done**: "I have a pattern I need to SAR. I need a well-written narrative
that will satisfy the examiner. I need it now."

**How they arrive**:
- Google search: "SAR narrative template structuring" or "BSA SAR narrative velocity anomaly"
- Referral from a peer BSA Officer at another institution
- NBA or NAOBA newsletter or conference mention
- Econofi blog post or social post linking to a specific template

### User Journey

**Step 1 — Land on a template page or the library index**
No login wall. No email gate on the template itself. The narrative is readable
immediately. This is critical: BSA Officers who hit a login wall before seeing
the content will leave. Trust is earned by giving the value first.

**Step 2 — Read the template**
The template page contains:
- Pattern name and plain-English description
- The MDI Context callout (how this pattern differs at a community institution)
- The regulatory citations with links to source documents
- The full narrative template, clearly formatted
- Customization guidance — what to replace, what to keep, what the examiner looks for
- A "last updated" date and the regulatory basis for that version

**Step 3 — Take an action**
Three conversion options, ordered by friction:
1. Copy to clipboard — zero friction, no data captured (acceptable — the visit itself has value)
2. Download as Word document — soft gate: name + work email required. The Word version
   includes the customization guidance as tracked changes comments, making it more useful
   than the copy-paste version.
3. "Email me when this template is updated" — single email field. Captures the user
   into a HubSpot workflow tied to that specific pattern.

**Step 4 — Related content**
Below every template: related patterns, related regulatory guidance, and a single
non-intrusive line: "Econofi's TransactionMonitor detects this pattern automatically
and generates a narrative draft for BSA Officer review. Learn more."

---

## Features

### Library Index Page

- Search bar: full-text search across all template content
- Filter by pattern category (primary navigation)
- Filter by institution type: bank / credit union (affects MDI Context callout)
- Filter by account type: retail / small business / nonprofit / cash-intensive business
- Sort by: most downloaded, most recently updated, regulatory citation date
- Each card shows: pattern name, one-line description, regulatory citation, last updated

### Template Page (per template)

- **Pattern Header**: Name, category, regulatory basis, severity range (low/medium/high/critical)
- **Plain-English Description**: What this pattern looks like in transaction data. Written
  for a BSA Officer, not a regulator. No jargon beyond what the exam manual uses.
- **MDI Context Callout** (visually distinct box):
  How this pattern manifests at an MDI or community credit union. What makes it different
  from the commercial bank baseline. What legitimate explanations exist. Why false positives
  are common at community institutions. This is the section no other resource provides.
- **Regulatory Citations** (sidebar or callout):
  Primary statute, implementing regulation, FinCEN guidance documents, FFIEC exam manual
  section. Each citation links to the source document on a government website.
- **The Narrative Template**:
  Full SAR narrative in FinCEN format. Placeholder text in [BRACKETS] for institution-
  specific detail. Written at the level of quality an examiner expects.
- **Customization Guidance**:
  Line-by-line notes on what the examiner looks for, what to replace, what language
  to keep verbatim, common mistakes.
- **Copy / Download / Subscribe** actions
- **Related Templates**: 2–3 related patterns (e.g., structuring → smurfing, threshold proximity)
- **Was this template helpful?**: thumbs up/down + optional comment. Feeds a Slack
  notification for content quality monitoring.

### Update Notification System

When a FinCEN advisory, FATF list change, or FFIEC guidance update affects a template,
all subscribers who downloaded or subscribed to that template receive a plain-text email:

> Subject: SAR Narrative Template Updated — Structuring (31 USC §5324)
>
> FinCEN Advisory FIN-2026-A003 (April 2026) updated guidance on structuring
> detection at community institutions. We have revised the structuring narrative
> template to reflect this guidance. The updated template is at [link].
>
> Key change: [one sentence plain-English summary]

This is not a marketing email. It is a compliance alert. Open rates will be high.

---

## Pattern Taxonomy

### Primary Categories (top-level navigation)

**1. Structuring** — 31 USC §5324
- Single account, multiple branches, same day (smurfing)
- Multiple accounts, coordinated sub-threshold deposits
- Threshold proximity — transactions at $9,900–$9,999
- Structured withdrawals
- Structuring + cash-intensive business (restaurant, laundromat, car wash)

**2. Velocity Anomaly**
- Dormant account sudden activation — large deposit or wire
- Account volume spike — 3x transaction count vs. 6-month baseline
- Account amount spike — 5x dollar volume vs. 6-month baseline
- New account rapid movement — funds in and out within 48 hours

**3. Geographic Risk** — FATF / OFAC
- Transaction involving FATF blacklist country (Iran, North Korea, Myanmar)
- Transaction involving FATF greylist jurisdiction
- Transaction involving known offshore shell company jurisdiction
  (Cayman Islands, British Virgin Islands, Panama, Seychelles)
- Correspondent bank in high-risk jurisdiction

**4. Round-Dollar Patterns**
- Wire transfers at exact round amounts — no cents, pattern across multiple transactions
- ACH round-dollar concentration inconsistent with payroll or benefits
- Round-dollar pattern combined with velocity anomaly

**5. Multiple Indicators (combination patterns)**
- Structuring + geographic risk
- Velocity anomaly + geographic risk
- Round-dollar + dormant account activation
- Three or more indicators (critical severity)

**6. Account Takeover / Identity**
- Third-party deposits to account — funds received from unrelated parties
- Rapid beneficiary changes on wire instructions
- Multiple wires to same beneficiary from different accounts

### MDI-Specific Pattern Notes (per category)

Each category includes a standing note on MDI context:

- **Structuring**: Cash-primary communities — $4,000 multi-branch same-day deposits
  are common legitimate behavior. Template includes language to document the investigation
  of community context before concluding structuring intent.
- **Velocity**: Nonprofit and community organization accounts have irregular revenue cycles
  (grant funding, fundraising events). Template distinguishes between dormant retail accounts
  and nonprofit accounts with event-driven deposit patterns.
- **Geographic**: Remittance activity to Latin America, West Africa, and Southeast Asia
  is disproportionately common at MDIs serving immigrant communities. Template includes
  guidance on distinguishing remittance patterns from sanctions exposure.

---

## Data Sources

### Primary Regulatory Sources (all public)

| Source | What it provides | URL |
|---|---|---|
| FinCEN SAR Instructions | Official narrative format requirements | fincen.gov |
| FinCEN Advisories (FIN-xxxx) | Pattern-specific guidance by money laundering typology | fincen.gov/resources/advisories |
| FFIEC BSA/AML Examination Manual | What examiners look for — the authoritative reference | ffiec.gov/bsa_aml_infobase |
| OCC BSA/AML Comptroller's Handbook | National bank exam standards | occ.gov |
| NCUA BSA Examination Procedures | Credit union-specific exam standards | ncua.gov |
| FATF Recommendations + Typologies | Geographic risk and money laundering methods | fatf-gafi.org |
| Federal Register (FinCEN, CFPB, OCC) | Regulatory updates affecting SAR requirements | federalregister.gov |
| FinCEN SAR Stats Report | Aggregate data on SAR filing patterns by institution type | fincen.gov/reports |
| DOJ Press Releases (BSA prosecutions) | Real-world pattern examples from public court records | justice.gov |

### Content Development Approach

Templates are not AI-generated and published unreviewed. Each template goes through:

1. Draft from regulatory source material (FFIEC manual + FinCEN advisory for that pattern)
2. Review against actual FinCEN SAR form requirements (FinCEN Form 111)
3. MDI Context callout drafted based on MDI transaction pattern research
4. Legal review flag: a note that the template does not constitute legal advice
5. Publish with explicit source citations and last-updated date

Initial library: 15–20 templates covering the primary pattern types.
Expanded library: 40–50 templates within 12 months, driven by FinCEN advisory calendar
and user requests ("Was this template helpful?" feedback).

---

## Technical Architecture

### Decision: Static Site + HubSpot Embed

CMS Hub is not required. The three integration points that matter — forms, contact
tracking, and workflow triggers — all work via HubSpot's embed script on a static site.
CMS Hub adds content editing without a developer, smart content personalization, and
HubSpot's native SEO tools. None of those are blockers for MVP launch.

Revisit CMS Hub when: a marketing hire needs to update content without touching code,
or when smart content (different CTAs for returning contacts) is worth the investment.

**Monthly cost of static site approach: $0**

---

### Stack

| Layer | Tool | Cost | Notes |
|---|---|---|---|
| Framework | Astro | Free | Static site generator — fast builds, SEO-optimized, minimal JS shipped to browser |
| Hosting | Netlify or Vercel | Free tier | Sufficient for this traffic level indefinitely |
| Search | Fuse.js | Free | Client-side full-text search — no backend, no API calls, no cost |
| Forms | HubSpot embed script | Free | Identical behavior to native CMS Hub forms |
| Contact tracking | HubSpot tracking code | Free | Page visits appear in HubSpot contact timelines |
| Content | Markdown files in GitHub | Free | One `.md` file per template — editable by anyone |
| CI/CD | Netlify or Vercel auto-deploy | Free | Push to GitHub main branch → live in 60 seconds |

---

### URL Structure

The SAR library is hosted on a Cloudflare-proxied subdomain of econofi.app.

**Why subdomain, not subdirectory**: `www.econofi.app` resolves directly to
HubSpot's CDN (`hscoscdn40.net`) with Cloudflare in DNS-only mode (grey cloud).
A Cloudflare Worker cannot intercept grey-cloud traffic. Toggling `www` to
orange cloud would introduce a double-proxy with HubSpot's CDN and risk
breaking the existing site. The subdomain avoids all of that — new DNS record,
no changes to existing configuration, no risk to the HubSpot site.

**URLs:**

```
sar.econofi.app/
sar.econofi.app/structuring/
sar.econofi.app/structuring/smurfing/
sar.econofi.app/structuring/threshold-proximity/
sar.econofi.app/velocity-anomaly/
sar.econofi.app/velocity-anomaly/dormant-account/
sar.econofi.app/geographic-risk/
sar.econofi.app/geographic-risk/fatf-blacklist/
sar.econofi.app/round-dollar/
sar.econofi.app/multiple-indicators/
```

---

### Deployment — Step by Step

**Step 1 — Deploy the Astro site to Netlify**

1. Push the Astro project to a GitHub repository
2. Log into Netlify > **Add new site** > **Import an existing project**
3. Connect GitHub, select the repository
4. Build settings:
   - Build command: `astro build`
   - Publish directory: `dist`
5. Click **Deploy site**
6. Netlify assigns a default URL (e.g. `econofi-sar-library.netlify.app`) —
   note it but do not use it as the production URL

---

**Step 2 — Add a DNS record in Cloudflare**

1. Cloudflare dashboard > select the **econofi.app** zone
2. **DNS** > **Records** > **Add record**

```
Type:     CNAME
Name:     sar
Target:   econofi-sar-library.netlify.app
TTL:      Auto
Proxy:    Orange cloud (Proxied)
```

Set proxy to orange cloud — this is a new record with no existing traffic,
no risk to the HubSpot site.

3. Save

---

**Step 3 — Add the custom domain in Netlify**

1. Netlify dashboard > your site > **Domain management** > **Add a domain**
2. Enter: `sar.econofi.app`
3. Netlify verifies the Cloudflare CNAME and provisions an SSL certificate
   automatically via Let's Encrypt
4. Within a few minutes `sar.econofi.app` is live with HTTPS

---

**Step 4 — Configure Astro**

In `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sar.econofi.app',
  base: '/',
  integrations: [sitemap()],
});
```

The `site` property ensures the sitemap and canonical tags use the correct
production URL. No `base` path adjustment needed — Astro serves from the
root of the subdomain.

---

**Step 5 — Verify**

1. Visit `https://sar.econofi.app` — confirm the library index loads
2. Click through to a template page — confirm URL stays on `sar.econofi.app`
3. In HubSpot > **Reports** > **Traffic Analytics** — confirm
   `sar.econofi.app` traffic appears within 24 hours
4. Open a test contact record in HubSpot — page visits from `sar.econofi.app`
   should appear in the contact activity timeline alongside visits to
   `www.econofi.app`

---

**What HubSpot sees**

The HubSpot tracking code (same Hub ID as the main site) is included in the
Astro base layout. HubSpot recognises the same visitor across both domains
and merges activity into one contact record. A BSA Officer who reads a blog
post on `www.econofi.app`, then downloads a SAR template on `sar.econofi.app`,
appears as one contact with a unified timeline — not two separate visitors.

This cross-domain tracking works automatically when both sites use the same
HubSpot tracking script with the same Hub ID. No additional configuration
required beyond what is already specified in the HubSpot Integration section.

---

### Content Structure (GitHub Repository)

Each template is a Markdown file with frontmatter. Astro reads the frontmatter
to build the index page, category pages, filter UI, and search index automatically.

```
/src/templates/
  structuring/
    smurfing.md
    threshold-proximity.md
    structured-withdrawals.md
    cash-intensive-business.md
  velocity-anomaly/
    dormant-account-activation.md
    volume-spike.md
    amount-spike.md
    new-account-rapid-movement.md
  geographic-risk/
    fatf-blacklist.md
    fatf-greylist.md
    offshore-shell-jurisdiction.md
    correspondent-bank.md
  round-dollar/
    wire-concentration.md
    ach-pattern.md
  multiple-indicators/
    structuring-plus-geo.md
    velocity-plus-geo.md
    three-indicator.md
```

**Template frontmatter schema:**

```yaml
---
title: "SAR Narrative Template — Smurfing (Multi-Branch Structuring)"
category: structuring
slug: smurfing
pattern_code: STR-002
regulatory_basis:
  - "31 USC §5324 — Structuring"
  - "31 CFR §1020.320 — SAR Filing Requirements"
severity_range: medium-high
institution_types:
  - bank
  - credit_union
account_types:
  - retail
  - small_business
  - cash_intensive_business
mdi_context: true
last_updated: 2026-04-29
regulatory_source: "FFIEC BSA/AML Examination Manual, Section 5.2"
fincen_advisory: "FIN-2014-A005"
legal_disclaimer: true
---
```

Astro generates the template page, the category index, the search index,
and the sitemap automatically from these files. Adding a new template is
creating one Markdown file and pushing to GitHub.

---

### HubSpot Integration — Step by Step

#### Step 1 — Add HubSpot Tracking Code to the Existing Econofi Website Footer

This is the single most important setup step. It connects the static SAR library
to the existing HubSpot CRM so that visitor activity on the library pages
appears in HubSpot contact timelines alongside activity on the main Econofi site.

**How to find your HubSpot tracking code:**

1. Log into HubSpot
2. Click the settings gear icon (top right)
3. In the left sidebar: **Tracking & Analytics** > **Tracking Code**
4. Copy the entire script block — it looks like this:

```html
<!-- HubSpot Tracking Code -->
<script type="text/javascript" id="hs-script-loader" async defer
  src="//js.hs-scripts.com/YOUR_HUB_ID.js">
</script>
```

The number in the URL (`YOUR_HUB_ID`) is your HubSpot account ID. Keep this number —
you will use it for form embeds as well.

**How to add it to the existing Econofi HubSpot website footer:**

1. In HubSpot, go to **Marketing** > **Website** > **Website Pages**
2. Click **Settings** (or the gear icon next to your active theme)
3. Navigate to **Advanced** > **Additional code snippets**
4. In the **Footer HTML** section, paste the tracking script
5. Click **Save**

Alternatively, if your HubSpot site uses a shared footer template:

1. Go to **Marketing** > **Files and Templates** > **Design Tools**
2. Find the footer module or global partial used across the site
3. Add the tracking script before the closing `</body>` tag
4. Publish the template

**How to add it to the static SAR library site:**

In your Astro project, open `src/layouts/BaseLayout.astro` (or equivalent base
layout). Add the HubSpot tracking script before the closing `</body>` tag:

```html
<!-- src/layouts/BaseLayout.astro -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- your existing head content -->
  </head>
  <body>
    <slot />

    <!-- HubSpot Tracking Code — same Hub ID as main Econofi site -->
    <script
      type="text/javascript"
      id="hs-script-loader"
      async
      defer
      src="//js.hs-scripts.com/YOUR_HUB_ID.js"
    ></script>
  </body>
</html>
```

Use the **same Hub ID** as the main Econofi site. HubSpot will recognize returning
visitors across both properties and merge the activity into one contact record.

**Verify it is working:**

1. Visit a page on the static SAR library site
2. In HubSpot, go to **Reports** > **Analytics Tools** > **Traffic Analytics**
3. Within 24 hours, traffic from the SAR library URL should appear
4. Open a test contact record — page visits from the library should appear
   in the contact's activity timeline

---

#### Step 2 — Embed HubSpot Forms on Template Pages

HubSpot forms are embedded on static pages via a two-part script. Create the forms
in HubSpot first, then embed them in the Astro templates.

**Create forms in HubSpot:**

1. Go to **Marketing** > **Lead Capture** > **Forms**
2. Click **Create form** > **Embedded form**
3. Build Form 1 (Word Download): First name, Last name, Work email, Institution name
4. Build Form 2 (Template Update Subscription): Work email only
5. On each form's **Options** tab:
   - Set a thank-you message (not a redirect) — keeps the user on the template page
   - Enable "Pre-populate fields for known contacts" — returning visitors skip fields
     they have already filled
6. On the **Style** tab: match form styling to the SAR library design
7. Click **Publish**

**Get the embed code:**

After publishing, click **Actions** > **Share** on each form.
Copy the embed code — it looks like this:

```html
<script charset="utf-8" type="text/javascript"
  src="//js.hsforms.net/forms/embed/v2.js">
</script>
<script>
  hbspt.forms.create({
    region: "na1",
    portalId: "YOUR_HUB_ID",
    formId: "FORM_GUID_HERE"
  });
</script>
```

**Add to Astro template pages:**

In the Astro template page component, place the form embed in the download section:

```astro
<!-- src/pages/sar-library/[category]/[slug].astro -->
<div class="download-section">
  <h3>Download as Word Document</h3>
  <p>Includes customization guidance as inline comments.</p>

  <!-- HubSpot Form 1 — Word Download -->
  <script
    charset="utf-8"
    type="text/javascript"
    src="//js.hsforms.net/forms/embed/v2.js"
  ></script>
  <script>
    hbspt.forms.create({
      region: "na1",
      portalId: "YOUR_HUB_ID",
      formId: "WORD_DOWNLOAD_FORM_GUID",
      onFormSubmit: function() {
        // Trigger Word doc download after form submission
        window.location.href = "/downloads/[pattern-slug].docx";
      }
    });
  </script>
</div>
```

The `onFormSubmit` callback fires the actual file download after the form submits —
the user fills the form, HubSpot captures the contact, and the Word file downloads
automatically. No manual step required.

---

#### Step 3 — Set Custom Contact Properties in HubSpot

Before forms go live, create the custom properties that track SAR library engagement.

1. In HubSpot, go to **Settings** > **Properties** > **Contact Properties**
2. Click **Create property** for each of the following:

| Property Label | Internal Name | Field Type |
|---|---|---|
| SAR Library Visitor | `sar_library_visitor` | Single checkbox |
| SAR Library Download Count | `sar_library_download_count` | Number |
| First Pattern Downloaded | `first_pattern_downloaded` | Single-line text |
| Patterns Downloaded | `patterns_downloaded` | Multiple checkboxes |
| Institution Type (Self-Reported) | `institution_type_self_reported` | Dropdown (Bank / Credit Union / Other) |
| SAR Library Last Visit | `sar_library_last_visit` | Date |

3. On Form 1 (Word Download), map the **Institution name** field to
   a contact property (`company` or a custom `institution_name` property)
4. Add a hidden field to Form 1 that captures which template triggered the
   download — set the default value to the pattern slug in the Astro embed:

```javascript
hbspt.forms.create({
  portalId: "YOUR_HUB_ID",
  formId: "WORD_DOWNLOAD_FORM_GUID",
  onFormReady: function(form) {
    // Set hidden field to the current template slug
    form.querySelector('[name="first_pattern_downloaded"]')
        .value = "smurfing"; // Set dynamically per template in Astro
  }
});
```

In Astro, pass the pattern slug from the Markdown frontmatter into the embed script
as a template variable — this sets the hidden field automatically for every template.

---

#### Step 4 — Build HubSpot Workflows

**Workflow 1 — First Download Nurture**
- Trigger: Contact property `sar_library_download_count` equals 1
- Delay: 3 days
- Action: Send email — subject line uses personalization token
  `"How we detect {{first_pattern_downloaded}} automatically"`
- Email content: educational explainer on TransactionMonitor detection
  for that specific pattern. Links to the TransactionMonitor product page.

**Workflow 2 — Warm Lead Signal**
- Trigger: `sar_library_download_count` equals 3
- Action: Create deal in pipeline, set lifecycle stage to `Marketing Qualified Lead`,
  send internal notification to sales with contact summary

**Workflow 3 — Template Update Alert**
- Trigger: Manual enrollment (triggered when a template is updated)
- Audience: Contacts subscribed to that pattern's update list
- Action: Send plain-text email with the change summary

**Workflow 4 — FATF Alert**
- Trigger: Manual enrollment
- Audience: All `sar_library_visitor = true` contacts
- Action: Send FATF change alert email

---

### SEO Configuration (Astro)

Astro generates a sitemap automatically with `@astrojs/sitemap`. Each template
page gets its own entry. Add to `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://econofi.app',
  integrations: [sitemap()],
});
```

Each template page sets its own meta tags from frontmatter:

```astro
---
// src/pages/sar-library/[category]/[slug].astro
const { title, regulatory_basis, category } = Astro.props.template;
---
<head>
  <title>{title} | Econofi SAR Narrative Library</title>
  <meta name="description"
    content={`Free SAR narrative template for ${category} suspicious activity.
    Regulatory basis: ${regulatory_basis[0]}. MDI and community bank context included.`}
  />
</head>
```

Submit the sitemap to Google Search Console under the existing Econofi property
(or add the SAR library subdirectory as a new property if on a subdomain).

### HubSpot Forms and Lead Capture

**Form 1 — Word Document Download (primary conversion)**
Fields: First name, Last name, Work email, Institution name  
Trigger: Click "Download as Word"  
HubSpot action: Create/update contact, set property `sar_library_download = true`,
set property `first_pattern_downloaded = [pattern name]`

**Form 2 — Template Update Subscription**
Fields: Work email only  
Trigger: Click "Email me when this template is updated"  
HubSpot action: Subscribe contact to pattern-specific list, e.g., `sar_updates_structuring`

**Form 3 — Library Index Newsletter**
Fields: Work email, Institution type (bank / credit union)  
Trigger: Bottom of library index page — "Get notified when new templates are added"  
HubSpot action: Subscribe to `sar_library_new_templates` list

### HubSpot Contact Properties (custom)

| Property | Type | Purpose |
|---|---|---|
| `sar_library_visitor` | Boolean | True if visited any library page |
| `sar_library_download_count` | Number | Total downloads across all templates |
| `first_pattern_downloaded` | String | First template pattern — signals BSA focus area |
| `patterns_downloaded` | Multi-select | All patterns downloaded — builds profile |
| `institution_type_self_reported` | String | Bank / credit union — from form or filter selection |
| `sar_library_last_visit` | Date | Recency signal |

### HubSpot Workflows

**Workflow 1 — First Download Nurture**
Trigger: `sar_library_download = true` (first download)  
Delay: 3 days  
Action: Send email — "How TransactionMonitor detects [first_pattern_downloaded] automatically"  
This email is educational, not a pitch. It explains the detection logic for their
specific pattern. Link goes to the TransactionMonitor product page.

**Workflow 2 — Repeat Engagement Signal**
Trigger: `sar_library_download_count` reaches 3  
Action: Create deal in HubSpot CRM, notify sales, set lead status to `warm`  
Rationale: Three downloads signals a BSA Officer actively using the library.
This is the highest-intent free-resource signal available.

**Workflow 3 — Pattern Update Alert**
Trigger: Manual enrollment when a template is updated  
Audience: All contacts subscribed to that pattern's update list  
Action: Send plain-text update email (see Update Notification System above)

**Workflow 4 — Regulatory Event Alert**
Trigger: Manual enrollment  
Audience: All `sar_library_visitor` contacts  
Action: Send FATF Watch alert or FinCEN advisory summary  
This is the bridge between the SAR Library and the FATF Watch idea —
the library subscriber list becomes the FATF Watch list.

### SEO Architecture

Each template page is an independent SEO target. BSA Officers search for
specific pattern types, not for "SAR template library."

Target keyword clusters per template:
- "SAR narrative template [pattern]"
- "SAR narrative example [pattern]"
- "how to write a SAR narrative [pattern]"
- "BSA suspicious activity report [pattern] example"

Each template page should include:
- Unique title tag: "SAR Narrative Template — [Pattern Name] | Econofi"
- Meta description citing the regulatory basis and the MDI context angle
- Schema markup: Article type, date published, date modified
- Internal links to related templates and the TransactionMonitor product page
- External links to FinCEN source documents (builds trust with search engines)

The MDI Context callout on each page is a meaningful content differentiator —
no other SAR template resource addresses MDI-specific pattern context. This
supports long-tail ranking for searches like "SAR narrative template community bank"
or "structuring SAR example minority depository institution."

---

## Launch Plan

### Phase 1 — MVP (4–6 weeks)

Build 12 templates covering the four primary pattern categories:
- 3 structuring variants
- 3 velocity anomaly variants
- 2 geographic risk variants
- 2 round-dollar variants
- 2 combination / multiple indicator patterns

Launch the library index and all 12 template pages.
HubSpot forms for download and update subscription.
Workflows 1 and 2 active.

Seeding: Submit to National Bankers Association newsletter. Post in BSA compliance
LinkedIn groups. Email Econofi's existing contact list.

### Phase 2 — Expansion (months 2–6)

Add 20–30 additional templates based on:
- FinCEN advisory releases
- User feedback ("Was this template helpful?" — request patterns)
- Seasonal patterns (tax season cash activity, holiday retail structuring)

Launch FATF Watch email as a feature of the library (Workflow 4).
Add institution type filter (bank vs. credit union variants of each template).

### Phase 3 — Authority (months 6–12)

Publish the MDI Compliance Burden benchmark report, cross-linked to the library.
SAR library subscriber list becomes the survey distribution list.
Pitch a guest post or resource mention to NAOBA, NBA, and NCIF.
Submit the library as a resource reference to the FFIEC's community bank portal.

---

## What the Library Is Not

- It is not legal advice. Every page carries a clear disclaimer.
- It is not a SAR filing system. It produces narrative text, not FinCEN Form 111 submissions.
- It is not AI-generated content published without review. Every template cites its
  regulatory source and carries a last-updated date.
- It is not a marketing page. No product CTAs above the fold. The Econofi connection
  is present but not the point — the template is the point.

The moment it feels like a lead magnet rather than a reference tool, BSA Officers stop
sharing it with peers. The credibility of the resource depends on it being genuinely useful
first and Econofi-branded second.
