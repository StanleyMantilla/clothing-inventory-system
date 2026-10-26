import { useEffect, useRef, useState } from "react";
import "./AboutUs.css";

const STORAGE_KEY = "clothstock-about-us-v1";
const DEFAULT_DATA = {
  description:
    "ClothStock is a Clothing Inventory Management System designed to help clothing businesses organize products, monitor stock levels, and record sales efficiently.",
  developers: [],
};

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_DATA, ...JSON.parse(saved) } : DEFAULT_DATA;
  } catch {
    return DEFAULT_DATA;
  }
}

export default function AboutUs() {
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [data, setData] = useState(readSaved);
  const [draft, setDraft] = useState({ name: "", role: "Developer", description: "", photo: "" });
  const [editingIndex, setEditingIndex] = useState(-1);
  const [confirmDelete, setConfirmDelete] = useState(-1);
  const fileRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {
      // Large photos may exceed browser storage; ask users to choose a smaller image.
    }
  }, [data]);

  useEffect(() => {
    if (!open) { setManage(false); setEditingIndex(-1); setConfirmDelete(-1); }
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function resetDraft() {
    setDraft({ name: "", role: "Developer", description: "", photo: "" });
    setEditingIndex(-1);
    if (fileRef.current) fileRef.current.value = "";
  }

  function editDeveloper(index) {
    setDraft({ ...data.developers[index] });
    setEditingIndex(index);
    if (fileRef.current) fileRef.current.value = "";
  }

  function saveDeveloper(event) {
    event.preventDefault();
    const profile = { ...draft, name: draft.name.trim(), description: draft.description.trim() };
    if (!profile.name) return;
    setData((previous) => {
      const developers = [...previous.developers];
      if (editingIndex >= 0) developers[editingIndex] = profile;
      else developers.push(profile);
      return { ...previous, developers };
    });
    resetDraft();
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 1024 * 1024) {
      alert("Please choose an image smaller than 1 MB to fit browser storage.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDraft((previous) => ({ ...previous, photo: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  function deleteDeveloper(index) {
    setData((previous) => ({ ...previous, developers: previous.developers.filter((_, i) => i !== index) }));
    setConfirmDelete(-1);
    if (editingIndex === index) resetDraft();
  }

  return (
    <>
      <button className="about-launcher" type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">✦</span> ABOUT US
      </button>

      {open && (
        <div className="about-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
            <header className="about-dialog-header">
              <div className="about-heading-mark">C</div>
              <div className="about-heading-copy">
                <span className="about-eyebrow">GET TO KNOW US</span>
                <h2 id="about-title">About ClothStock</h2>
              </div>
              <button className="about-close" type="button" aria-label="Close About Us" onClick={() => setOpen(false)}>×</button>
            </header>

            <div className="about-dialog-body">
             
<div className="about-project">
  <div className="about-project-icon">
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M23 10 12 16 3 29l11 8 7-9v27h22V28l7 9 11-8-9-13-11-6c-2 6-5 9-9 9s-7-3-9-9Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M25 10c1 5 3 8 7 8s6-3 7-8"
        stroke="#087943"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  </div>

  <h3 className="about-project-brand">
    Cloth<span>Stock</span>
  </h3>

  <p className="about-project-subtitle">
    Clothing Inventory Management System
  </p>

  <div className="about-project-accent" />

  <p className="about-description">
    {data.description}
  </p>

  <div className="about-tags">
    <span>Inventory</span>
    <span>Stock Tracking</span>
    <span>Sales Records</span>
  </div>
</div>


              <div className="about-team">
                <div className="about-section-heading">
                  <div><span className="about-eyebrow">THE PEOPLE BEHIND THE PROJECT</span><h3>Meet the Developers</h3></div>
                  <button className="about-manage-toggle" type="button" onClick={() => setManage((value) => !value)}>
                    {manage ? "Done" : "Manage profiles"}
                  </button>
                </div>

                {data.developers.length === 0 ? (
                  <div className="about-empty"><span>♧</span><strong>Developer profiles coming soon</strong><p>Add your team members using Manage profiles.</p></div>
                ) : (
                  <div className="about-developer-grid">
                    {data.developers.map((person, index) => (
                      <article className="about-developer-card" key={`${person.name}-${index}`}>
                        {person.photo ? <img className="about-avatar" src={person.photo} alt={`${person.name} profile`} /> :
                          <div className="about-avatar about-avatar-placeholder">{person.name?.trim()?.charAt(0)?.toUpperCase() || "D"}</div>}
                        <h4>{person.name}</h4><span className="about-role">{person.role || "Developer"}</span>
                        {person.description && <p>{person.description}</p>}
                        {manage && <div className="about-profile-actions">
                          <button type="button" onClick={() => editDeveloper(index)}>Edit</button>
                          <button className="danger" type="button" onClick={() => setConfirmDelete(index)}>Delete</button>
                        </div>}
                        {confirmDelete === index && <div className="about-confirm"><span>Delete this profile?</span><button type="button" onClick={() => deleteDeveloper(index)}>Confirm</button><button type="button" onClick={() => setConfirmDelete(-1)}>Cancel</button></div>}
                      </article>
                    ))}
                  </div>
                )}

                {manage && <form className="about-editor" onSubmit={saveDeveloper}>
                  <h4>{editingIndex >= 0 ? "Edit developer" : "Add a developer"}</h4>
                  <div className="about-form-grid">
                    <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={100} placeholder="Developer name" /></label>
                    <label>Role<input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} maxLength={80} placeholder="e.g. Frontend Developer" /></label>
                  </div>
                  <label>Description<textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} rows={3} placeholder="Short introduction" /></label>
                  <label className="about-upload">Profile picture<input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} /></label>
                  {draft.photo && <img className="about-photo-preview" src={draft.photo} alt="Profile preview" />}
                  <div className="about-editor-actions"><button className="about-save" type="submit">{editingIndex >= 0 ? "Save changes" : "Add developer"}</button><button type="button" onClick={resetDraft}>Clear</button></div>
                  <p className="about-storage-note">Profiles are saved in this browser only. Choose images under 1 MB.</p>
                </form>}
              </div>
            </div>
            <footer className="about-dialog-footer"><span>BSIT 3-C · Event Driven Programming Project</span><button type="button" onClick={() => setOpen(false)}>Close</button></footer>
          </section>
        </div>
      )}
    </>
  );
}
