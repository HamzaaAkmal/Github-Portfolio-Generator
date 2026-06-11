"use client";

import {
  ArrowRight,
  Check,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Github,
  Globe2,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  Trash2,
  Upload
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createPortfolioBundle,
  downloadPortfolioZip
} from "@/lib/export-portfolio";
import { renderPortfolioHtml } from "@/lib/render-portfolio";
import type {
  GeneratedContent,
  GitHubImportResponse,
  GitHubProfile,
  PortfolioProject,
  PortfolioTemplate
} from "@/lib/types";

const steps = [
  "Connect GitHub",
  "Choose projects",
  "Generate content",
  "Edit portfolio",
  "Publish"
];

const stepSlugs = ["connect", "projects", "generate", "edit", "publish"];

const templates: Array<{
  id: PortfolioTemplate;
  name: string;
  description: string;
}> = [
  {
    id: "obsidian",
    name: "Obsidian",
    description: "The original centered hero and editorial project grid."
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "A visual split hero with larger featured project imagery."
  },
  {
    id: "signal",
    name: "Signal",
    description: "A compact, technical layout with horizontal project cards."
  }
];

interface ApiError {
  error?: string;
}

function getErrorMessage(payload: ApiError | null, fallback: string) {
  return payload?.error || fallback;
}

function slugFromUsername(username: string) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function emptyProfile(): GitHubProfile {
  return {
    login: "",
    name: "",
    avatarUrl: "",
    bio: "",
    location: "",
    company: "",
    email: "",
    blog: "",
    htmlUrl: "",
    followers: 0,
    following: 0,
    publicRepos: 0,
    socials: []
  };
}

function selectedCount(projects: PortfolioProject[]) {
  return projects.filter((project) => project.selected).length;
}

function featuredCount(projects: PortfolioProject[]) {
  return projects.filter((project) => project.selected && project.featured)
    .length;
}

export function PortfolioBuilder({ 
  baseDomain
}: { 
  baseDomain: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get initial step from URL or default to 0
  const getInitialStep = () => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const index = stepSlugs.indexOf(stepParam);
      return index !== -1 ? index : 0;
    }
    return 0;
  };
  
  const [activeStep, setActiveStep] = useState(getInitialStep);
  const [furthestStep, setFurthestStep] = useState(getInitialStep);
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<GitHubProfile>(emptyProfile);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [images, setImages] = useState<Record<number, File>>({});
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [template, setTemplate] = useState<PortfolioTemplate>("obsidian");
  const [slug, setSlug] = useState("");
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [deployedUrl, setDeployedUrl] = useState("");
  const [notice, setNotice] = useState("");
  const resumeUrlRef = useRef<string>("");

  useEffect(() => {
    if (activeStep !== 4 || !/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(slug)) {
      setSlugAvailable(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const response = await fetch(
          `/api/deploy/check?slug=${encodeURIComponent(slug)}`,
          { signal: controller.signal }
        );
        const payload = (await response.json()) as {
          available?: boolean;
        };
        if (!controller.signal.aborted) {
          setSlugAvailable(
            response.ok && typeof payload.available === "boolean"
              ? payload.available
              : false
          );
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setSlugAvailable(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingSlug(false);
        }
      }
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeStep, slug]);

  function advance(step: number) {
    setActiveStep(step);
    setFurthestStep((current) => Math.max(current, step));
    router.push(`/?step=${stepSlugs[step]}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function importProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setImporting(true);
    setDeployedUrl("");

    try {
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const payload = (await response.json()) as GitHubImportResponse & ApiError;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "GitHub import failed."));
      }

      setProfile(payload.profile);
      setProjects(payload.repositories);
      setSlug(slugFromUsername(payload.profile.login));
      setContent(null);
      setResume(null);
      setImages({});
      advance(1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "GitHub import failed.");
    } finally {
      setImporting(false);
    }
  }

  function updateProject(
    id: number,
    changes: Partial<PortfolioProject>
  ) {
    setProjects((current) =>
      current.map((project) =>
        project.id === id ? { ...project, ...changes } : project
      )
    );
  }

  function toggleSelected(project: PortfolioProject) {
    const count = selectedCount(projects);
    if (!project.selected && count >= 10) {
      setNotice("You can select up to 10 projects maximum.");
      return;
    }

    setNotice("");
    updateProject(project.id, {
      selected: !project.selected,
      featured: project.selected ? false : project.featured
    });
  }

  function toggleFeatured(project: PortfolioProject) {
    if (!project.selected) {
      setNotice("Select the project before featuring it.");
      return;
    }
    const currentFeatured = featuredCount(projects);
    const selected = selectedCount(projects);
    
    // Allow featuring/unfeaturing when appropriate
    if (!project.featured && selected >= 3 && currentFeatured >= 3) {
      setNotice("You can feature up to 3 projects. Unfeature one first.");
      return;
    }

    setNotice("");
    updateProject(project.id, { featured: !project.featured });
  }

  function addCustomProject() {
    const id = -Date.now();
    setProjects((current) => [
      {
        id,
        owner: profile.login,
        name: "",
        fullName: "",
        description: "",
        htmlUrl: "",
        homepage: "",
        language: "",
        languages: {},
        stars: 0,
        forks: 0,
        topics: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        selected: selectedCount(current) < 10,
        featured: false,
        custom: true
      },
      ...current
    ]);
  }

  function removeProject(project: PortfolioProject) {
    if (project.imageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(project.imageUrl);
    }
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setImages((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });
  }

  function uploadProjectImage(
    project: PortfolioProject,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setNotice("Project images must be PNG, JPG, or WEBP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setNotice("Project images must be 4 MB or smaller.");
      return;
    }

    // Resize and optimize the image
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.onload = () => {
        // Create canvas for resizing (ideal card size: 1200x675 for 16:9 ratio)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const maxWidth = 1200;
        const maxHeight = 675;
        let width = img.width;
        let height = img.height;
        
        // Calculate aspect ratio
        const aspectRatio = width / height;
        
        if (width > maxWidth || height > maxHeight) {
          if (aspectRatio > maxWidth / maxHeight) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and resize image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (!blob) return;
          
          const resizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          
          if (project.imageUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(project.imageUrl);
          }
          const imageUrl = URL.createObjectURL(resizedFile);
          setImages((current) => ({ ...current, [project.id]: resizedFile }));
          updateProject(project.id, {
            imageName: resizedFile.name,
            imageUrl
          });
          setNotice("");
        }, file.type, 0.9);
      };
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  }

  function continueToGeneration() {
    const selected = projects.filter((project) => project.selected);
    const featured = selected.filter((project) => project.featured);

    if (!selected.length) {
      setNotice("Select at least one project.");
      return;
    }
    if (selected.length > 10) {
      setNotice("You can select up to 10 projects maximum.");
      return;
    }
    // Make featured projects optional if less than 3 selected
    if (selected.length >= 3 && featured.length > 3) {
      setNotice("You can feature up to 3 projects maximum.");
      return;
    }
    if (selected.some((project) => !project.name.trim())) {
      setNotice("Every selected project needs a name.");
      return;
    }

    setNotice("");
    advance(2);
  }

  function uploadResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf") {
      setNotice("Resume must be a PDF.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setNotice("Resume must be 12 MB or smaller.");
      return;
    }

    if (resumeUrlRef.current) {
      URL.revokeObjectURL(resumeUrlRef.current);
    }
    resumeUrlRef.current = URL.createObjectURL(file);
    setResume(file);
    setNotice("");
  }

  async function generateContent() {
    if (!resume) {
      setNotice("Upload a PDF resume before generating.");
      return;
    }

    const selected = projects.filter((project) => project.selected).slice(0, 10);
    const imageEntries = selected
      .filter((project) => images[project.id])
      .sort((a, b) => Number(b.featured) - Number(a.featured))
      .slice(0, 3);
    const form = new FormData();
    form.append(
      "data",
      JSON.stringify({
        profile,
        projects: selected,
        imageProjectIds: imageEntries.map((project) => project.id)
      })
    );
    form.append("resume", resume);
    imageEntries.forEach((project) => {
      form.append("images", images[project.id]);
    });

    setGenerating(true);
    setNotice("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        body: form
      });
      const payload = (await response.json()) as {
        content?: GeneratedContent;
        languages?: Array<{ id: number; languages: Record<string, number> }>;
        error?: string;
      };

      if (!response.ok || !payload.content) {
        throw new Error(getErrorMessage(payload, "AI generation failed."));
      }

      const languageMap = new Map(
        (payload.languages || []).map((item) => [item.id, item.languages])
      );
      const insightMap = new Map(
        payload.content.projectInsights.map((insight) => [
          insight.projectId,
          insight
        ])
      );
      setProjects((current) =>
        current.map((project) => {
          const insight = insightMap.get(project.id);
          return {
            ...project,
            languages: languageMap.get(project.id) || project.languages,
            aiTagline: insight?.tagline || project.aiTagline,
            aiImpact: insight?.impact || project.aiImpact
          };
        })
      );
      setContent(payload.content);
      advance(3);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  function updateSkillGroup(
    index: number,
    changes: Partial<GeneratedContent["skillGroups"][number]>
  ) {
    setContent((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        skillGroups: current.skillGroups.map((group, groupIndex) =>
          groupIndex === index ? { ...group, ...changes } : group
        )
      };
    });
  }

  function addSkillGroup() {
    setContent((current) =>
      current
        ? {
            ...current,
            skillGroups: [
              ...current.skillGroups,
              { name: "Skills", skills: [] }
            ]
          }
        : current
    );
  }

  function removeSkillGroup(index: number) {
    setContent((current) =>
      current
        ? {
            ...current,
            skillGroups: current.skillGroups.filter(
              (_, groupIndex) => groupIndex !== index
            )
          }
        : current
    );
  }

  async function getBundle() {
    if (!content || !resume) {
      throw new Error("Generate the portfolio and attach a resume first.");
    }
    return createPortfolioBundle({
      profile,
      projects,
      content,
      template,
      resume,
      images
    });
  }

  async function downloadBundle() {
    setDownloading(true);
    setNotice("");
    try {
      const files = await getBundle();
      await downloadPortfolioZip(slug, files);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  async function checkSlug() {
    setCheckingSlug(true);
    setSlugAvailable(null);
    setNotice("");
    try {
      const response = await fetch(
        `/api/deploy/check?slug=${encodeURIComponent(slug)}`
      );
      const payload = (await response.json()) as {
        available?: boolean;
        domain?: string;
        error?: string;
      };
      if (!response.ok || typeof payload.available !== "boolean") {
        throw new Error(getErrorMessage(payload, "Name check failed."));
      }
      setSlugAvailable(payload.available);
      if (!payload.available) {
        setNotice(`${payload.domain} is already taken.`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Name check failed.");
    } finally {
      setCheckingSlug(false);
    }
  }

  async function deploy() {
    setPublishing(true);
    setNotice("");
    setDeployedUrl("");

    try {
      const files = await getBundle();
      const form = new FormData();
      form.append("slug", slug);
      files.forEach((file) => {
        form.append("files", file.blob, file.name);
      });

      const response = await fetch("/api/deploy", {
        method: "POST",
        body: form
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !payload.url) {
        throw new Error(getErrorMessage(payload, "Deployment failed."));
      }

      setSlugAvailable(false);
      setDeployedUrl(payload.url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Deployment failed.");
    } finally {
      setPublishing(false);
    }
  }

  const previewHtml = useMemo(() => {
    if (!content || !resumeUrlRef.current) {
      return "";
    }
    return renderPortfolioHtml({
      profile,
      projects,
      content,
      template,
      resumeUrl: resumeUrlRef.current,
      fontUrl: "/fonts/CalSans-SemiBold.ttf"
    });
  }, [content, profile, projects, template, resume]);

  return (
    <main className="builder-page">
      <div className="builder-beam" />

      <nav className="stepper" aria-label="Portfolio creation steps">
        {steps.map((step, index) => (
          <button
            key={step}
            type="button"
            className={index === activeStep ? "is-active" : ""}
            disabled={index > furthestStep}
            onClick={() => {
              if (index <= furthestStep) {
                setActiveStep(index);
                router.push(`/?step=${stepSlugs[index]}`);
              }
            }}
          >
            <span>{index < furthestStep ? <Check size={13} /> : index + 1}</span>
            {step}
          </button>
        ))}
      </nav>

      {notice ? <div className="notice">{notice}</div> : null}

      <section className="workspace">
        {activeStep === 0 ? (
          <div className="connect-panel">
            <div className="section-label">01 / Connect</div>
            <div className="connect-copy">
              <Github size={30} />
              <h2>Start with a GitHub username.</h2>
              <p>
                Public profile details and repositories are fetched directly
                from GitHub. No sample projects are inserted.
              </p>
            </div>
            <form className="username-form" onSubmit={importProfile}>
              <label htmlFor="github-username">github.com/</label>
              <input
                id="github-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                aria-label="GitHub username"
              />
              <button className="primary-button" disabled={importing}>
                {importing ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ArrowRight size={18} />
                )}
                Import profile
              </button>
            </form>
          </div>
        ) : null}

        {activeStep === 1 ? (
          <div className="project-workspace">
            <div className="workspace-heading">
              <div>
                <div className="section-label">02 / Curate</div>
                <h2>Choose your projects (1-10).</h2>
                <p>
                  Select 1 to 10 projects (3 recommended). Mark up to 3 as featured, 
                  edit any imported detail, add custom work, or attach interface screenshots.
                </p>
              </div>
              <div className="counter-stack">
                <strong>{selectedCount(projects)} / 10</strong>
                <span>{featuredCount(projects)} featured</span>
              </div>
            </div>

            <div className="profile-strip">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" />
              ) : null}
              <div>
                <strong>{profile.name}</strong>
                <span>@{profile.login}</span>
              </div>
              <div className="profile-stat">
                <strong>{profile.publicRepos}</strong>
                <span>public repos</span>
              </div>
              <button className="ghost-button" onClick={addCustomProject}>
                <Plus size={16} />
                Add project
              </button>
            </div>

            <div className="project-editor-grid">
              {projects.map((project) => (
                <article
                  className={`project-editor ${
                    project.selected ? "is-selected" : ""
                  }`}
                  key={project.id}
                >
                  <div className="project-editor-top">
                    <button
                      className={`selection-toggle ${
                        project.selected ? "is-on" : ""
                      }`}
                      type="button"
                      onClick={() => toggleSelected(project)}
                    >
                      {project.selected ? <Check size={14} /> : null}
                      {project.selected ? "Selected" : "Select"}
                    </button>
                    <button
                      type="button"
                      className={`feature-toggle ${
                        project.featured ? "is-on" : ""
                      }`}
                      onClick={() => toggleFeatured(project)}
                      title="Feature project"
                    >
                      <Star size={16} fill={project.featured ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-button"
                      onClick={() => removeProject(project)}
                      title="Remove project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <label>
                    Project name
                    <input
                      value={project.name}
                      onChange={(event) =>
                        updateProject(project.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      rows={3}
                      value={project.description}
                      onChange={(event) =>
                        updateProject(project.id, {
                          description: event.target.value
                        })
                      }
                    />
                  </label>
                  <div className="split-fields">
                    <label>
                      Main language
                      <input
                        value={project.language}
                        onChange={(event) =>
                          updateProject(project.id, {
                            language: event.target.value
                          })
                        }
                      />
                    </label>
                    <label>
                      Live URL
                      <input
                        type="url"
                        value={project.homepage}
                        onChange={(event) =>
                          updateProject(project.id, {
                            homepage: event.target.value
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Repository URL
                    <input
                      type="url"
                      value={project.htmlUrl}
                      onChange={(event) =>
                        updateProject(project.id, {
                          htmlUrl: event.target.value
                        })
                      }
                    />
                  </label>

                  <div className="project-editor-footer">
                    <label className="image-upload">
                      <ImagePlus size={16} />
                      {project.imageName || "Add screenshot (auto-resized to 1200×675)"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => uploadProjectImage(project, event)}
                      />
                    </label>
                    <span>★ {project.stars.toLocaleString()}</span>
                  </div>
                  {project.imageUrl ? (
                    <img
                      className="editor-image-preview"
                      src={project.imageUrl}
                      alt={`${project.name} preview`}
                    />
                  ) : null}
                </article>
              ))}
            </div>

            <div className="workspace-actions">
              <button className="secondary-button" onClick={() => advance(0)}>
                Change username
              </button>
              <button className="primary-button" onClick={continueToGeneration}>
                Continue
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : null}

        {activeStep === 2 ? (
          <div className="generation-workspace">
            <div className="workspace-heading">
              <div>
                <div className="section-label">03 / Generate</div>
                <h2>Add your resume and profile details.</h2>
                <p>
                  Kimi uses the resume, selected repositories, languages,
                  featured READMEs, and up to three screenshots.
                </p>
              </div>
              <Sparkles className="heading-icon" size={42} />
            </div>

            <div className="generation-grid">
              <div className="form-panel">
                <h3>Public profile</h3>
                <div className="split-fields">
                  <label>
                    Display name
                    <input
                      value={profile.name}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          email: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>
                <label>
                  GitHub bio
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        bio: event.target.value
                      }))
                    }
                  />
                </label>
                <div className="split-fields">
                  <label>
                    Location
                    <input
                      value={profile.location}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          location: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Company
                    <input
                      value={profile.company}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          company: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>
                <label>
                  Personal website
                  <input
                    type="url"
                    value={profile.blog}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        blog: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <div className="resume-drop-panel">
                <div className="resume-icon">
                  <FileText size={32} />
                </div>
                <h3>Resume PDF</h3>
                <p>
                  Included in the final ZIP and embedded directly in the live
                  portfolio.
                </p>
                <label className="resume-upload-button">
                  <Upload size={17} />
                  {resume ? "Replace resume" : "Upload resume"}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={uploadResume}
                  />
                </label>
                {resume ? (
                  <div className="file-pill">
                    <Check size={14} />
                    <span>{resume.name}</span>
                    <small>{(resume.size / 1024 / 1024).toFixed(2)} MB</small>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="ai-disclosure">
              <Sparkles size={18} />
              Resume text and chosen screenshots are sent to DigitalOcean
              Serverless Inference for this generation request.
            </div>

            <div className="workspace-actions">
              <button className="secondary-button" onClick={() => advance(1)}>
                Back to projects
              </button>
              <button
                className="primary-button"
                onClick={generateContent}
                disabled={generating}
              >
                {generating ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
                Generate with Kimi
              </button>
            </div>
          </div>
        ) : null}

        {activeStep === 3 && content ? (
          <div className="editor-workspace">
            <div className="workspace-heading">
              <div>
                <div className="section-label">04 / Refine</div>
                <h2>Everything remains editable.</h2>
                <p>
                  Review the generated narrative and project language before
                  choosing a template.
                </p>
              </div>
              <button
                className="ghost-button"
                onClick={() => advance(2)}
              >
                <RefreshCw size={16} />
                Regenerate
              </button>
            </div>

            <div className="content-editor">
              <label>
                Professional headline
                <input
                  value={content.headline}
                  onChange={(event) =>
                    setContent((current) =>
                      current
                        ? { ...current, headline: event.target.value }
                        : current
                    )
                  }
                />
              </label>
              <label>
                About summary
                <textarea
                  rows={6}
                  value={content.summary}
                  onChange={(event) =>
                    setContent((current) =>
                      current
                        ? { ...current, summary: event.target.value }
                        : current
                    )
                  }
                />
              </label>
            </div>

            <div className="subsection-heading">
              <div>
                <h3>Skill groups</h3>
                <p>Separate skills with commas.</p>
              </div>
              <button className="ghost-button" onClick={addSkillGroup}>
                <Plus size={15} />
                Add group
              </button>
            </div>
            <div className="skills-editor-grid">
              {content.skillGroups.map((group, index) => (
                <div className="skill-editor" key={`${group.name}-${index}`}>
                  <button
                    className="icon-button danger-button"
                    onClick={() => removeSkillGroup(index)}
                    title="Remove group"
                  >
                    <Trash2 size={15} />
                  </button>
                  <label>
                    Group name
                    <input
                      value={group.name}
                      onChange={(event) =>
                        updateSkillGroup(index, { name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Skills
                    <textarea
                      rows={3}
                      value={group.skills.join(", ")}
                      onChange={(event) =>
                        updateSkillGroup(index, {
                          skills: event.target.value
                            .split(",")
                            .map((skill) => skill.trim())
                            .filter(Boolean)
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="subsection-heading">
              <div>
                <h3>Project copy</h3>
                <p>Edit the generated tagline and impact statement.</p>
              </div>
            </div>
            <div className="project-copy-list">
              {projects
                .filter((project) => project.selected)
                .map((project) => (
                  <article key={project.id}>
                    <div className="project-copy-title">
                      <strong>{project.name}</strong>
                      {project.featured ? <span>Featured</span> : null}
                    </div>
                    <label>
                      Tagline
                      <input
                        value={project.aiTagline || ""}
                        onChange={(event) =>
                          updateProject(project.id, {
                            aiTagline: event.target.value
                          })
                        }
                      />
                    </label>
                    <label>
                      Impact statement
                      <textarea
                        rows={3}
                        value={project.aiImpact || ""}
                        onChange={(event) =>
                          updateProject(project.id, {
                            aiImpact: event.target.value
                          })
                        }
                      />
                    </label>
                  </article>
                ))}
            </div>

            <div className="workspace-actions">
              <button className="secondary-button" onClick={() => advance(2)}>
                Back
              </button>
              <button className="primary-button" onClick={() => advance(4)}>
                Choose template
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : null}

        {activeStep === 4 && content ? (
          <div className="publish-workspace">
            <div className="workspace-heading">
              <div>
                <div className="section-label">05 / Publish</div>
                <h2>Preview, download, or go live.</h2>
                <p>
                  Every option creates the same portable HTML, resume, font,
                  and uploaded project images.
                </p>
              </div>
              <Globe2 className="heading-icon" size={42} />
            </div>

            <div className="template-grid">
              {templates.map((item) => (
                <button
                  key={item.id}
                  className={template === item.id ? "is-selected" : ""}
                  onClick={() => setTemplate(item.id)}
                >
                  <div className={`template-swatch swatch-${item.id}`}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <strong>
                    {template === item.id ? <Check size={15} /> : null}
                    {item.name}
                  </strong>
                  <p>{item.description}</p>
                </button>
              ))}
            </div>

            <div className="preview-shell">
              <div className="preview-toolbar">
                <span />
                <span />
                <span />
                <div>
                  {slug || profile.login}.{baseDomain}
                </div>
              </div>
              <iframe title="Portfolio preview" srcDoc={previewHtml} />
            </div>

            <div className="publish-grid">
              <div className="publish-card">
                <div className="publish-icon">
                  <Download size={23} />
                </div>
                <h3>Download package</h3>
                <p>
                  Get a ZIP containing `index.html`, your PDF resume, font, and
                  project screenshots for any cPanel or static host.
                </p>
                <button
                  className="secondary-button full-button"
                  onClick={downloadBundle}
                  disabled={downloading}
                >
                  {downloading ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Download size={17} />
                  )}
                  Download HTML ZIP
                </button>
                <a
                  className="ghost-link full-button"
                  href={resumeUrlRef.current}
                  download="resume.pdf"
                >
                  <FileText size={17} />
                  Download resume PDF
                </a>
              </div>

              <div className="publish-card accent-card">
                <div className="publish-icon">
                  <Rocket size={23} />
                </div>
                <h3>One-click deploy</h3>
                <p>
                  Reserve a subdomain and upload the generated portfolio
                  directly through cPanel UAPI.
                </p>
                <div className="domain-control">
                  <input
                    value={slug}
                    onChange={(event) => {
                      setSlug(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                          .slice(0, 30)
                      );
                      setSlugAvailable(null);
                      setDeployedUrl("");
                    }}
                    aria-label="Portfolio subdomain"
                  />
                  <span>.{baseDomain}</span>
                </div>
                <div className="domain-actions">
                  <button
                    className="ghost-button"
                    onClick={checkSlug}
                    disabled={checkingSlug}
                  >
                    {checkingSlug ? (
                      <LoaderCircle className="spin" size={15} />
                    ) : (
                      <Globe2 size={15} />
                    )}
                    Check name
                  </button>
                  {slugAvailable === true ? (
                    <span className="available-label">
                      <Check size={14} /> Available
                    </span>
                  ) : slugAvailable === false ? (
                    <span className="taken-label">Taken</span>
                  ) : null}
                </div>
                <button
                  className="primary-button full-button"
                  onClick={deploy}
                  disabled={publishing || slugAvailable !== true}
                >
                  {publishing ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Rocket size={17} />
                  )}
                  Deploy portfolio
                </button>
              </div>
            </div>

            {deployedUrl ? (
              <div className="success-panel">
                <div className="success-header">
                  <Check size={20} />
                  <span>Portfolio deployed</span>
                </div>
                <div className="deployment-links">
                  <div className="link-row">
                    <span className="link-label">Subdomain (may take a few minutes):</span>
                    <a href={deployedUrl} target="_blank" rel="noreferrer">
                      {deployedUrl}
                      <ExternalLink size={15} />
                    </a>
                  </div>
                  <div className="link-row">
                    <span className="link-label">Direct link (live now):</span>
                    <a 
                      href={`https://${baseDomain}/${slug}/index.html`} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      {baseDomain}/{slug}/index.html
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="workspace-actions">
              <button className="secondary-button" onClick={() => advance(3)}>
                Back to editing
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="builder-footer">
        <span>Gitfolio</span>
        <a 
          href="https://www.linkedin.com/in/hamzaaakmal/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="footer-credit"
        >
          Created by Hamza Akmal
        </a>
      </footer>
    </main>
  );
}
