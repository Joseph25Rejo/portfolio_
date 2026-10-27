# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Design Component pages (`*.dc.html`) running on the bundled `support.js` runtime with vendored React. Confirmed by the owner: keep this as-is for now and improve later; a port to a framework is deliberately undecided. The pages must be served over HTTP, because the runtime fetches each `Room*.dc.html` and fails on `file://`.

## Users
Primary: recruiters and hiring managers evaluating Joseph for internships and full-time engineering roles. They skim, and need to find the résumé, the projects and the contact route quickly.
Secondary: startup founders and prospective clients who might commission a build, and collaborators. Roles come first.

## Product Purpose
The personal portfolio of Joseph Rejo Mathew, a full-stack developer and third-year B.E. student in Artificial Intelligence and Machine Learning at RV College of Engineering, Bengaluru. It presents his work, experience, skills, writing, achievements and contact details.
Success, as confirmed by the owner: the résumé gets downloaded; a project gets opened (demo, repository or video); and the site is remembered for the experience of using it.

## Positioning
The site is a house you climb. A spiral staircase leads to seven doors, one per section, and each door opens into a room (the Entrance, Workshop, Experience, Study, Library, Gallery and Final Landing). Other portfolios use a scrolling page of sections; this one makes navigation a physical walkthrough while still offering a floor indicator, a Directory menu and deep links (`#entrance`, `#workshop`, `#experience`, `#study`, `#library`, `#gallery`, `#landing`) for anyone who wants to skip the journey.

## Operating Context
Visitors arrive on a landing view with the name, a one-line description, "Begin the journey" and "Download résumé". They climb by scrolling, or jump with the floor indicator (desktop), the floor bar (mobile) or the Directory. Opening a door plays a door-swing and camera-dolly animation and then overlays the room; "Back to the landing" returns. Reduced-motion preferences are honoured in code.
The owner works from Bengaluru and keeps older portfolio versions (Portfolio-1 to Portfolio-4) as references only.

## Capabilities and Constraints
- Seven rooms: About (education, current role, three skill areas), Workshop (four projects with overview, architecture and demo tabs), Experience (Lume), Study (skills on shelves), Library (Medium articles and GitHub activity, loaded live), Gallery (awards, a publication, a patent application), Contact (form, links, résumé).
- Résumé is a PDF at `assets/e347ca2a9ec4bb8d9925776a0b9444c4.pdf`, downloaded as `Joseph_Rejo_Mathew_Resume.pdf`.
- Contact form is meant to send through EmailJS with fields name, email, optional phone and message, and sending, success and error states. In the current prototype, sending is simulated.
- Library data is meant to come from the Medium feed and the GitHub events and contributions APIs, including private contributions. The current room holds placeholder slots.
- Workshop projects: QuarksFinance, Hatch, ParkNGo and ORION. Cover screenshots and architecture diagrams are in `assets/projects/`.
- Names and terms to keep: "Lume CXM" (Block 8 Solutions Pvt. Ltd.), "Founding Engineer Intern", the room names above.
- Undecided: final framework and hosting; the Instagram handle; the publication's journal name.

## Brand Commitments
- Name: Joseph Rejo Mathew; short form "Joseph R.M." and initials JRM.
- Descriptor on the landing: "Developer · Engineering student · Product builder".
- Logo: JRM in Cormorant Garamond with a gold staircase stroke beneath it, on a transparent background, files in `brand/`. The owner rejected two earlier marks (an outlined arch with stairs, then a solid arch with a J) and asked that the logo never sit on a background plate.
- The hero line "Developer · Engineering student · Product builder" must never be covered by the header or logo.
- Voice: first person, plain and specific, no inflated claims. Lume's own client names may appear in the Lume product film (owner confirmed); client metrics are still left off.

## Evidence on Hand
- Lume: runs in production across 3 resort properties; 30+ Figma screens converted to React; one deployment per property on Railway, guest app on Vercel; analytics on PostHog.
- Education: RV College of Engineering, B.E. in AI and ML, Aug 2023 to present, CGPA 9.16/10.
- Awards: Winner (first prize), WhiteHack 1.0, organized by White Devils Tech Community, held 20 to 29 July 2025, with Hatch; Runner-Up, ExploreLikeALocal Hackathon (Sep 2024); Finalist, Mindscape Hackathon (BNM Institute of Technology with IBM SkillsBuild, 25 and 26 July 2025); Top Five, Ctrl + Alt + Compete Hackathon (RV College of Engineering, Electronics and Telecommunication, 8 June 2025). Certificates for the last three are in `assets/CERTIFICATES/`, with upright images in `assets/awards/`.
- Publication: "AI-Driven Pathogen Profiling in Scientific Literature using NLP", Jan 2025, DOI 10.37896/sr12.1/006.
- Patent application: ORION ("Bidirectional Consumption-Driven Retail Inventory and Demand Intelligence System"), India, No. 202641030238, filed 13 Mar 2026, published in the Patent Office Journal issue 22/2026 on 29 May 2026. Applicant: RV College of Engineering. Inventors: Somesh Nandi, B. Sathish Babu, Chirag H, Joseph Rejo Mathew. The journal entry is `assets/CERTIFICATES/Patent_ORION.pdf` (page 3).
- Assets: résumé PDF; project covers and architecture diagrams; a QuarksFinance demo video at https://youtu.be/pCVa_T0C6t4.
- Not available, so do not fabricate: demo videos for Hatch, ParkNGo and ORION; the ExploreLikeALocal certificate; the publication's journal name; the Instagram handle; product screenshots from Lume.

## Product Principles
1. The journey must never block the goal. Every room, the résumé and the contact route stay reachable in one step from anywhere, by keyboard or touch, without climbing.
2. Proof over claim. Every statement points to something real: a live demo, repository, diagram, DOI or patent number. Empty slots are marked honestly, never faked.
3. The house is the memorable part and the content is the point. The experience should be remembered, but a recruiter who skims for thirty seconds should still leave with the role, the stack, the projects and the résumé.
4. Say what Joseph built and shipped, and where it runs. Prefer specific facts (3 properties, 30+ screens) over adjectives.
5. Honest placeholders. Content that has not been supplied stays visibly pending in the source and is tracked in this file until it arrives.

## Accessibility & Inclusion
- Respect `prefers-reduced-motion`; the door and camera animations must have a non-animated path (already present in the code).
- All actions reachable by keyboard with visible focus; floor navigation and the Directory exist as alternatives to scroll-climbing.
- Text contrast of at least 4.5:1 for body text, and a layout that works on phones as well as desktop.
