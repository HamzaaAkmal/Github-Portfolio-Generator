import type { PortfolioData, PortfolioProject } from "@/lib/types";

const palette = [
  "#c084fc",
  "#60a5fa",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#38bdf8"
];

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value: string) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? escapeHtml(url.toString())
      : "";
  } catch {
    return "";
  }
}

function languageTotals(projects: PortfolioProject[]) {
  const totals = new Map<string, number>();

  projects.forEach((project) => {
    const entries = Object.entries(project.languages);
    if (entries.length) {
      entries.forEach(([language, bytes]) => {
        totals.set(language, (totals.get(language) || 0) + bytes);
      });
    } else if (project.language) {
      totals.set(project.language, (totals.get(project.language) || 0) + 1);
    }
  });

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

function projectCard(project: PortfolioProject) {
  const destination = safeUrl(project.homepage || project.htmlUrl);
  const repoUrl = safeUrl(project.htmlUrl);
  const title = escapeHtml(project.name);
  const description = escapeHtml(
    project.aiImpact || project.description || "View the project on GitHub."
  );
  const tagline = escapeHtml(project.aiTagline || project.description);
  const date = project.createdAt
    ? escapeHtml(project.createdAt.slice(0, 10))
    : "";
  const topics = project.topics
    .slice(0, 5)
    .map((topic) => `<span>${escapeHtml(topic)}</span>`)
    .join("");
  const image = project.imageUrl
    ? `<a class="project-image" href="${destination}" target="_blank" rel="noreferrer"><img src="${escapeHtml(
        project.imageUrl
      )}" alt="${title} interface" loading="lazy"></a>`
    : `<a class="project-image project-image--empty" href="${destination}" target="_blank" rel="noreferrer" aria-label="Open ${title}"><span>${escapeHtml(
        project.language || "GitHub"
      )}</span></a>`;

  return `
    <article class="project-card ${project.featured ? "is-featured" : ""}">
      ${image}
      <div class="project-body">
        <div class="project-meta">
          <time>${date}</time>
          <span>★ ${project.stars.toLocaleString("en-US")}</span>
        </div>
        <a class="project-title" href="${destination}" target="_blank" rel="noreferrer">${title}</a>
        ${tagline ? `<p class="project-tagline">${tagline}</p>` : ""}
        <p>${description}</p>
        ${topics ? `<div class="topic-list">${topics}</div>` : ""}
        <div class="project-links">
          ${
            repoUrl
              ? `<a href="${repoUrl}" target="_blank" rel="noreferrer">GitHub ↗</a>`
              : ""
          }
          ${
            project.homepage
              ? `<a href="${safeUrl(
                  project.homepage
                )}" target="_blank" rel="noreferrer">Live site ↗</a>`
              : ""
          }
        </div>
      </div>
    </article>`;
}

function contactLinks(data: PortfolioData) {
  const links = [
    data.profile.email
      ? {
          label: "Email",
          value: data.profile.email,
          href: `mailto:${data.profile.email}`
        }
      : null,
    {
      label: "GitHub",
      value: `@${data.profile.login}`,
      href: data.profile.htmlUrl
    },
    data.profile.blog
      ? {
          label: "Website",
          value: data.profile.blog.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          href: data.profile.blog
        }
      : null,
    ...data.profile.socials.map((social) => ({
      label: social.provider,
      value: social.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: social.url
    }))
  ].filter(Boolean) as Array<{ label: string; value: string; href: string }>;

  return links
    .map(
      (link) => `
      <a class="contact-card" href="${safeUrl(
        link.href
      )}" target="_blank" rel="noreferrer">
        <span>${escapeHtml(link.label)}</span>
        <strong>${escapeHtml(link.value)}</strong>
      </a>`
    )
    .join("");
}

export function renderPortfolioHtml(data: PortfolioData) {
  const projects = data.projects.filter((project) => project.selected).slice(0, 10);
  const featured = projects.filter((project) => project.featured).slice(0, 3);
  const remaining = projects.filter((project) => !project.featured);
  const languages = languageTotals(projects);
  const totalLanguageValue =
    languages.reduce((sum, [, value]) => sum + value, 0) || 1;
  const languageRows = languages
    .map(([language, value], index) => {
      const percentage = Math.max(2, Math.round((value / totalLanguageValue) * 100));
      return `
        <div class="language-row">
          <div><span>${escapeHtml(language)}</span><small>${percentage}%</small></div>
          <div class="language-track"><span style="width:${percentage}%;background:${
            palette[index % palette.length]
          }"></span></div>
        </div>`;
    })
    .join("");
  const skills = data.content.skillGroups
    .map(
      (group) => `
      <div class="skill-card">
        <span>${escapeHtml(group.name)}</span>
        <div>${group.skills
          .map((skill) => `<strong>${escapeHtml(skill)}</strong>`)
          .join("")}</div>
      </div>`
    )
    .join("");
  const locationLine = [data.profile.location, data.profile.company]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  const avatar = safeUrl(data.profile.avatarUrl);
  const resume = escapeHtml(data.resumeUrl);
  const fontUrl = escapeHtml(data.fontUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(data.content.headline)}">
  <title>${escapeHtml(data.profile.name)} · Portfolio</title>
  <style>
    @font-face{font-family:Cal Sans;src:url("${fontUrl}") format("truetype");font-display:swap}
    :root{color-scheme:dark;--bg:#050505;--panel:#111113;--muted:#a1a1aa;--line:#3f3f46;--white:#fafafa;--purple:#c084fc;--blue:#60a5fa}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--bg);color:var(--white);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
    body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 0,rgba(113,113,122,.18),transparent 38%),linear-gradient(to bottom right,#050505,rgba(63,63,70,.11),#050505);z-index:-2}
    body:after{content:"";position:fixed;inset:0;pointer-events:none;opacity:.18;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.08'/%3E%3C/svg%3E");z-index:-1}
    a{color:inherit;text-decoration:none}
    img{display:block;max-width:100%}
    .shell{width:min(1180px,calc(100% - 40px));margin:auto}
    .nav{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(63,63,70,.65);background:rgba(5,5,5,.75);backdrop-filter:blur(18px)}
    .nav-inner{height:72px;display:flex;align-items:center;justify-content:space-between}
    .brand{font:600 21px "Cal Sans",sans-serif;letter-spacing:.02em}
    .nav-links{display:flex;gap:24px;color:var(--muted);font-size:14px}
    .nav-links a:hover{color:white}
    .hero{min-height:calc(100vh - 73px);display:grid;align-items:center;padding:80px 0}
    .hero-grid{display:grid;grid-template-columns:1fr auto;align-items:center;gap:60px}
    .eyebrow{display:flex;align-items:center;gap:12px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.18em;font-size:12px}
    .eyebrow:before{content:"";width:42px;height:1px;background:linear-gradient(90deg,transparent,#a1a1aa)}
    h1,h2,.project-title{font-family:"Cal Sans",ui-sans-serif,sans-serif}
    h1{margin:20px 0 16px;font-size:clamp(60px,10vw,145px);line-height:.85;letter-spacing:-.045em;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.42);background:linear-gradient(135deg,#fff 15%,#a1a1aa 75%);-webkit-background-clip:text;background-clip:text}
    .headline{max-width:760px;font-size:clamp(20px,3vw,34px);line-height:1.25;color:#d4d4d8}
    .location{color:#71717a;margin-top:18px}
    .avatar{width:132px;height:132px;border-radius:999px;border:1px solid #52525b;box-shadow:0 0 80px rgba(96,165,250,.15);transition:.7s transform;object-fit:cover}
    .avatar:hover{transform:scale(1.08) rotate(2deg)}
    .beam{height:1px;width:100%;background:linear-gradient(90deg,transparent,rgba(212,212,216,.6),transparent)}
    section{padding:110px 0}
    .section-heading{display:grid;grid-template-columns:180px 1fr;gap:40px;margin-bottom:50px}
    .section-number{color:#71717a;font-size:13px;letter-spacing:.15em;text-transform:uppercase}
    h2{font-size:clamp(40px,6vw,76px);line-height:1;margin:0 0 20px;letter-spacing:-.03em}
    .section-copy{max-width:760px;color:#a1a1aa;font-size:18px}
    .featured-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:18px}
    .project-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
    .project-card{overflow:hidden;border:1px solid #3f3f46;border-radius:18px;background:rgba(24,24,27,.36);transition:.45s transform,.45s border-color,.45s background}
    .project-card:hover{transform:translateY(-5px);border-color:#71717a;background:rgba(39,39,42,.5)}
    .project-image{height:230px;overflow:hidden;background:linear-gradient(135deg,rgba(192,132,252,.18),rgba(96,165,250,.06))}
    .project-image img{width:100%;height:100%;object-fit:cover;transition:.7s transform}
    .project-card:hover .project-image img{transform:scale(1.035)}
    .project-image--empty{display:grid;place-items:center;background:radial-gradient(circle at 30% 30%,rgba(192,132,252,.23),transparent 35%),radial-gradient(circle at 70% 60%,rgba(96,165,250,.2),transparent 40%),#0c0c0e}
    .project-image--empty span{font:600 clamp(28px,4vw,56px) "Cal Sans";color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.35)}
    .project-body{padding:26px}
    .project-meta{display:flex;justify-content:space-between;color:#71717a;font-size:12px}
    .project-title{display:inline-block;margin-top:12px;font-size:30px;line-height:1.1;background:linear-gradient(90deg,var(--purple),var(--blue));color:transparent;background-clip:text;-webkit-background-clip:text}
    .project-tagline{color:#d4d4d8!important;font-weight:600}
    .project-body p{color:#a1a1aa;margin:12px 0}
    .topic-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:18px}
    .topic-list span{font-size:11px;padding:5px 9px;border:1px solid #3f3f46;border-radius:999px;color:#a1a1aa}
    .project-links{display:flex;gap:18px;margin-top:22px;font-size:13px;color:#d4d4d8}
    .project-links a:hover{color:#60a5fa}
    .capability-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px}
    .language-panel,.skills-panel,.resume-panel{border:1px solid #3f3f46;border-radius:18px;padding:32px;background:rgba(24,24,27,.3)}
    .panel-title{font:600 26px "Cal Sans";margin-bottom:26px}
    .language-row{margin:17px 0}
    .language-row>div:first-child{display:flex;justify-content:space-between;color:#d4d4d8;font-size:13px}
    .language-row small{color:#71717a}
    .language-track{height:5px;background:#27272a;border-radius:999px;overflow:hidden;margin-top:8px}
    .language-track span{display:block;height:100%;border-radius:inherit}
    .skill-card{padding:16px 0;border-bottom:1px solid #27272a}
    .skill-card:last-child{border:0}
    .skill-card>span{display:block;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px}
    .skill-card div{display:flex;flex-wrap:wrap;gap:8px}
    .skill-card strong{font-size:13px;font-weight:500;color:#d4d4d8}
    .resume-panel{padding:0;overflow:hidden}
    .resume-toolbar{display:flex;align-items:center;justify-content:space-between;padding:22px 26px;border-bottom:1px solid #3f3f46}
    .resume-toolbar strong{font:600 24px "Cal Sans"}
    .button{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border:1px solid #52525b;border-radius:8px;font-size:13px;transition:.25s}
    .button:hover{border-color:#d4d4d8;background:#27272a}
    .resume-frame{width:100%;height:760px;border:0;background:#18181b}
    .contact-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .contact-card{min-height:150px;border:1px solid #3f3f46;border-radius:14px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;transition:.35s}
    .contact-card:hover{border-color:#a1a1aa;transform:translateY(-3px)}
    .contact-card span{color:#71717a;text-transform:uppercase;letter-spacing:.14em;font-size:11px}
    .contact-card strong{font:500 20px "Cal Sans";overflow-wrap:anywhere}
    footer{border-top:1px solid #27272a;padding:32px 0;color:#71717a;font-size:13px}
    .footer-inner{display:flex;justify-content:space-between}
    body.template-aurora .hero{min-height:760px}
    body.template-aurora .hero-grid{grid-template-columns:1.15fr .85fr}
    body.template-aurora .avatar{width:min(34vw,360px);height:min(34vw,360px);border-radius:24px}
    body.template-aurora h1{font-size:clamp(58px,9vw,120px)}
    body.template-aurora .featured-grid{grid-template-columns:1.4fr 1fr}
    body.template-aurora .featured-grid .project-card:first-child{grid-row:span 2}
    body.template-aurora .featured-grid .project-card:first-child .project-image{height:440px}
    body.template-signal h1{-webkit-text-stroke:0;background:linear-gradient(90deg,#c084fc,#60a5fa,#22d3ee);background-clip:text;-webkit-background-clip:text}
    body.template-signal .hero{min-height:680px}
    body.template-signal .hero-grid{border:1px solid #3f3f46;border-radius:24px;padding:54px;background:rgba(17,17,19,.55)}
    body.template-signal .featured-grid,body.template-signal .project-grid{grid-template-columns:1fr}
    body.template-signal .project-card{display:grid;grid-template-columns:320px 1fr}
    body.template-signal .project-image{height:100%}
    @media(max-width:900px){
      .hero-grid,.section-heading,.capability-grid{grid-template-columns:1fr}
      .hero-grid{gap:30px}.avatar{width:100px;height:100px}
      .featured-grid,.project-grid,.contact-grid{grid-template-columns:1fr}
      body.template-aurora .featured-grid{grid-template-columns:1fr}
      body.template-aurora .featured-grid .project-card:first-child .project-image{height:230px}
      body.template-signal .project-card{grid-template-columns:1fr}
      body.template-signal .project-image{height:230px}
      .section-heading{gap:10px}
    }
    @media(max-width:620px){
      .shell{width:min(100% - 24px,1180px)}
      .nav-links{gap:12px;font-size:12px}
      .hero{padding:55px 0;min-height:650px}
      h1{font-size:clamp(52px,19vw,92px)}
      section{padding:78px 0}
      .resume-frame{height:540px}
      .footer-inner{gap:15px;flex-direction:column}
      body.template-signal .hero-grid{padding:26px}
    }
  </style>
</head>
<body class="template-${escapeHtml(data.template)}">
  <nav class="nav">
    <div class="shell nav-inner">
      <a class="brand" href="#home">${escapeHtml(data.profile.name)}</a>
      <div class="nav-links">
        <a href="#projects">Projects</a>
        <a href="#skills">Skills</a>
        <a href="#resume">Resume</a>
        <a href="#contact">Contact</a>
      </div>
    </div>
  </nav>
  <main>
    <section class="hero" id="home">
      <div class="shell hero-grid">
        <div>
          <div class="eyebrow">GitHub portfolio</div>
          <h1>${escapeHtml(data.profile.name)}</h1>
          <div class="headline">${escapeHtml(data.content.headline)}</div>
          ${locationLine ? `<div class="location">${locationLine}</div>` : ""}
        </div>
        ${
          avatar
            ? `<img class="avatar" src="${avatar}" alt="${escapeHtml(
                data.profile.name
              )}">`
            : ""
        }
      </div>
    </section>
    <div class="beam"></div>
    <section id="about">
      <div class="shell section-heading">
        <div class="section-number">01 / About</div>
        <div>
          <h2>Building with intent.</h2>
          <div class="section-copy">${escapeHtml(data.content.summary)}</div>
        </div>
      </div>
    </section>
    <section id="projects">
      <div class="shell">
        <div class="section-heading">
          <div class="section-number">02 / Selected work</div>
          <div><h2>Projects</h2><div class="section-copy">A selection of public work, shaped from live GitHub data.</div></div>
        </div>
        <div class="featured-grid">${featured.map(projectCard).join("")}</div>
        <div class="project-grid">${remaining.map(projectCard).join("")}</div>
      </div>
    </section>
    <section id="skills">
      <div class="shell">
        <div class="section-heading">
          <div class="section-number">03 / Capabilities</div>
          <div><h2>Tools & languages</h2><div class="section-copy">Repository language usage and evidence-backed skills.</div></div>
        </div>
        <div class="capability-grid">
          <div class="language-panel"><div class="panel-title">Language graph</div>${languageRows}</div>
          <div class="skills-panel"><div class="panel-title">Skill map</div>${skills}</div>
        </div>
      </div>
    </section>
    <section id="resume">
      <div class="shell">
        <div class="section-heading">
          <div class="section-number">04 / Resume</div>
          <div><h2>Experience</h2><div class="section-copy">The complete uploaded resume, available to read or download.</div></div>
        </div>
        <div class="resume-panel">
          <div class="resume-toolbar"><strong>Resume</strong><a class="button" href="${resume}" download>Download PDF</a></div>
          <iframe class="resume-frame" title="${escapeHtml(
            data.profile.name
          )} resume" src="${resume}"></iframe>
        </div>
      </div>
    </section>
    <section id="contact">
      <div class="shell">
        <div class="section-heading">
          <div class="section-number">05 / Contact</div>
          <div><h2>Let’s connect.</h2><div class="section-copy">Find me through the channels below.</div></div>
        </div>
        <div class="contact-grid">${contactLinks(data)}</div>
      </div>
    </section>
  </main>
  <footer><div class="shell footer-inner"><span>Created using <a href="https://github.com/HamzaaAkmal/Github-Portfolio-Generator" target="_blank" rel="noopener noreferrer" style="color:#60a5fa">Gitfolio</a></span><span>${new Date().getFullYear()}</span></div></footer>
</body>
</html>`;
}
