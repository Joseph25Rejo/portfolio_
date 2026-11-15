/* The single source for work experience. The Experience room, Quick view, About room and search data all read this.

   TO ADD A NEW JOB
   1. Put the new object at the TOP of `roles` (newest first).
   2. Give the old role an `end` month. `end: null` means "present".
   3. Everything else is optional. Leave out `duties`, `stack`, `facts`, `log` or `film` and the room hides that block.

   Role shape:
   {
     id: 'short-slug',
     company: 'Company name',           // shown on the plaque and the timeline
     org: 'Legal entity, City',         // optional second line on the plaque
     logo: './assets/...webp',          // optional (white-on-dark logo); text is used if missing
     logoW: 900, logoH: 372,            // optional, the logo's pixel size
     title: 'Founding Engineer',
     start: '2026-06',                  // YYYY-MM
     end: null,                         // YYYY-MM, or null while you still work there
     summary: 'One or two sentences.',  // the headline paragraph
     short: 'One line.',                // optional
     quick: 'Paragraph for Quick view.', // optional
     duties: [{ title, body }],         // optional
     stack: ['React', ...],             // optional
     facts: [{ big: '15', text: '...' }], // optional
     log: [{ title, items: [[status, text]] }], // optional. status: Shipped | Done | In progress | Designed | Planned
     film: { label, caption, src, poster, aria } // optional
   }
*/
window.JRM_EXP = {
  roles: [
    {
      id: 'lume',
      company: 'Lume CXM',
      org: 'Block 8 Solutions Pvt. Ltd.<br>Bengaluru, India',
      logo: './assets/lume/lume-logo-white.webp', logoW: 900, logoH: 372,
      title: 'Founding Engineer',
      start: '2026-06',
      end: null,
      summary: 'The founding engineer at a bootstrapped hospitality-tech startup, building fully branded guest web apps for premium Indian resorts.',
      short: 'Fully branded guest web apps for premium Indian resorts, running across 3 properties.',
      quick: 'Fully branded guest web apps for premium Indian resorts, running across 3 properties. I rebuilt the guest app from Figma in React and TypeScript, rebuilt the staff dashboard on Next.js (15 hubs, role-based access), moved the backend onto a private network, and documented 182 API operations. One deployment per property on Railway, the guest app on Vercel, analytics in PostHog.',
      duties: [
        { title: 'Guest apps, end to end', body: 'Rebuilt the guest app as a token-gated React and TypeScript app from Figma, with live data and stay-phase routing, from pre-arrival through checkout.' },
        { title: 'A dashboard for staff', body: 'Built the staff dashboard on Next.js: 15 hubs, role-based access, live previews, booking verification, analytics with Excel export, and a comms hub over Resend.' },
        { title: 'Deployment and infrastructure', body: 'Moved the backend onto a private network behind the dashboard, with an httpOnly cookie and access tiers. One deployment per client, running across 3 resort properties.' },
        { title: 'Leading the work', body: 'Led project and development activities, driving technical implementation and coordinating the product development lifecycle.' }
      ],
      stack: ['React', 'TypeScript', 'Vite', 'Next.js', 'Node.js', 'Express', 'MongoDB Atlas', 'Railway', 'Vercel', 'Cloudflare R2', 'Resend', 'Razorpay', 'OpenAI', 'Oracle Opera Cloud (OHIP)', 'PostHog / HogQL', 'OpenAPI', 'Postman', 'Figma'],
      facts: [
        { big: '15', text: 'hubs in the staff dashboard, rebuilt from scratch' },
        { big: '3', text: 'resort properties running the application in production' },
        { big: '182', text: 'API operations documented in OpenAPI' }
      ],
      log: [
        { title: 'Frontend and infrastructure', items: [
          ['Shipped', 'Guest app rebuilt in React, TypeScript and Vite: token-gated, with stay-phase routing, four tabs and live data. Staff dashboard rebuilt on Next.js 14 with 15 hubs.'],
          ['Shipped', 'One deployment per client on Railway. Backend on a private network behind the dashboard, with an httpOnly cookie and Admin, GM and Staff access tiers.'],
          ['Shipped', 'Guest uploads moved from Cloudinary to Cloudflare R2, one bucket per client.']
        ]},
        { title: 'Backend and documentation', items: [
          ['Shipped', 'One Booking ID per stay, 29 models, about 194 route handlers, and AI routing of guest requests to departments with strict JSON output.'],
          ['Shipped', 'OpenAPI spec of 182 operations, a Postman collection, a self-verifying seed script that runs in about 20 seconds, and onboard and offboard scripts.']
        ]},
        { title: 'Integrations and analytics', items: [
          ['Done', 'Mapped 15 Oracle Opera Cloud API domains and built a read-only UAT Postman collection of 11 requests with documented findings.'],
          ['In progress', 'Polling design for the integration. The PMS stays the source of truth; Lume keeps a synced copy keyed by the booking ID.'],
          ['Shipped', 'Guest analytics on PostHog HogQL. Funnel analysis surfaced a silent submit failure in online check-in.']
        ]},
        { title: 'Next', items: [
          ['Planned', 'Guest app to Railway, onboarding rollout, automated tests, and retiring the legacy booking-create endpoint.']
        ]}
      ],
      film: {
        label: 'Before and after',
        caption: 'The rebuild, in 49 seconds.',
        src: './assets/videos/Lume-before-after.mp4',
        poster: './assets/lume/before-after-poster.webp',
        cta: 'Watch the before and after',
        aria: 'Lume before and after rebuild film'
      }
    }
  ]
};
