"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import type {
  WineBottleCandidate,
  WineColor
} from "@/lib/wineRecognitionTypes";

type CandidateStatus = "pending" | "confirmed" | "rejected";

type EditableCandidate = WineBottleCandidate & {
  id: string;
  status: CandidateStatus;
};

const colors: WineColor[] = [
  "red",
  "white",
  "rose",
  "sparkling",
  "dessert",
  "fortified",
  "unknown"
];

const emptyBottle: WineBottleCandidate = {
  producer: null,
  name: null,
  vintage: null,
  region: null,
  country: null,
  appellation: null,
  varietal: null,
  color: "unknown",
  confidence: 1,
  uncertaintyNotes: "",
  rawLabelText: ""
};

export default function ScanWinePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [savedBottles, setSavedBottles] = useState<WineBottleCandidate[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const confirmedCount = useMemo(
    () => candidates.filter((candidate) => candidate.status === "confirmed").length,
    [candidates]
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setCandidates([]);
    setMessage("");
    setError("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleRecognize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a bottle photo first.");
      return;
    }

    setIsRecognizing(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch("/api/recognize-wine", {
        method: "POST",
        body: formData
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Recognition failed.");
      }

      const nextCandidates = Array.isArray(body.bottles)
        ? body.bottles.map((candidate: WineBottleCandidate, index: number) =>
            toEditableCandidate(candidate, `detected-${Date.now()}-${index}`)
          )
        : [];

      setCandidates(nextCandidates);
      setMessage(
        nextCandidates.length === 0
          ? "No bottles detected."
          : `${nextCandidates.length} bottle candidate${nextCandidates.length === 1 ? "" : "s"} found.`
      );
    } catch (recognitionError) {
      setError(
        recognitionError instanceof Error
          ? recognitionError.message
          : "Recognition failed."
      );
    } finally {
      setIsRecognizing(false);
    }
  }

  function updateCandidate(
    id: string,
    field: keyof WineBottleCandidate,
    value: string
  ) {
    setCandidates((current) =>
      current.map((candidate) => {
        if (candidate.id !== id) {
          return candidate;
        }

        if (field === "vintage") {
          return {
            ...candidate,
            vintage: value ? Number(value) : null
          };
        }

        if (field === "confidence") {
          return {
            ...candidate,
            confidence: Number(value)
          };
        }

        if (field === "color") {
          return {
            ...candidate,
            color: value as WineColor
          };
        }

        if (field === "uncertaintyNotes" || field === "rawLabelText") {
          return {
            ...candidate,
            [field]: value
          };
        }

        return {
          ...candidate,
          [field]: value.trim() ? value : null
        };
      })
    );
  }

  function setCandidateStatus(id: string, status: CandidateStatus) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, status } : candidate
      )
    );
  }

  function addManualBottle() {
    setCandidates((current) => [
      ...current,
      toEditableCandidate(
        {
          ...emptyBottle,
          uncertaintyNotes: "Added manually by user."
        },
        `manual-${Date.now()}`
      )
    ]);
  }

  function saveConfirmed() {
    const confirmed = candidates
      .filter((candidate) => candidate.status === "confirmed")
      .map(stripCandidateState);

    setSavedBottles((current) => [...confirmed, ...current]);
    setCandidates((current) =>
      current.filter((candidate) => candidate.status !== "confirmed")
    );
    setMessage(`${confirmed.length} bottle${confirmed.length === 1 ? "" : "s"} saved.`);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Cellar</strong>
          <span>Add / Scan Wine</span>
        </div>
        <div className="session">Signed in</div>
      </header>

      <main className="main">
        <section className="scan-panel">
          <div className="section-heading">
            <div>
              <h1>Add / Scan Wine</h1>
              <p className="muted">Review every candidate before saving.</p>
            </div>
            <button className="button secondary" type="button" onClick={addManualBottle}>
              Add manually
            </button>
          </div>

          <form onSubmit={handleRecognize}>
            <div className="upload-row">
              <label className="file-control">
                <span className="file-label">Choose photo</span>
                <input
                  accept="image/*"
                  capture="environment"
                  name="image"
                  type="file"
                  onChange={handleFileChange}
                />
              </label>
              <button className="button" disabled={isRecognizing} type="submit">
                {isRecognizing ? "Scanning..." : "Scan"}
              </button>
              {selectedFile ? <span className="muted">{selectedFile.name}</span> : null}
            </div>
          </form>

          {previewUrl ? (
            <div className="preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Selected wine bottle" src={previewUrl} />
            </div>
          ) : null}

          {message ? <div className="status">{message}</div> : null}
          {error ? <div className="error">{error}</div> : null}

          {candidates.length > 0 ? (
            <>
              <div className="candidate-grid">
                {candidates.map((candidate, index) => (
                  <CandidateCard
                    candidate={candidate}
                    index={index}
                    key={candidate.id}
                    onChange={updateCandidate}
                    onStatusChange={setCandidateStatus}
                  />
                ))}
              </div>

              <div className="status">
                <button
                  className="button"
                  disabled={confirmedCount === 0}
                  type="button"
                  onClick={saveConfirmed}
                >
                  Save confirmed ({confirmedCount})
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="cellar-panel">
          <div className="section-heading">
            <div>
              <h2>Cellar</h2>
              <p className="muted">{savedBottles.length} saved in this session</p>
            </div>
          </div>

          <div className="cellar-list">
            {savedBottles.length === 0 ? (
              <p className="muted">No confirmed bottles saved.</p>
            ) : (
              savedBottles.map((bottle, index) => (
                <div className="cellar-item" key={`${bottle.name}-${index}`}>
                  <div>
                    <strong>{displayWineName(bottle)}</strong>
                    <div className="cellar-meta">
                      {[bottle.vintage, bottle.region, bottle.country, bottle.color]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span className="confidence">
                    {Math.round(bottle.confidence * 100)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function CandidateCard({
  candidate,
  index,
  onChange,
  onStatusChange
}: {
  candidate: EditableCandidate;
  index: number;
  onChange: (id: string, field: keyof WineBottleCandidate, value: string) => void;
  onStatusChange: (id: string, status: CandidateStatus) => void;
}) {
  const isLowConfidence = candidate.confidence < 0.65;

  return (
    <article className="candidate-card">
      <div className="card-header">
        <div>
          <h3>Bottle {index + 1}</h3>
          <p className="muted">{candidate.status}</p>
        </div>
        <span className={`confidence ${isLowConfidence ? "low" : ""}`}>
          {isLowConfidence ? "Low " : ""}
          {Math.round(candidate.confidence * 100)}%
        </span>
      </div>

      <div className="form-grid">
        <TextField
          id={candidate.id}
          label="Producer"
          field="producer"
          value={candidate.producer}
          onChange={onChange}
        />
        <TextField
          id={candidate.id}
          label="Name"
          field="name"
          value={candidate.name}
          onChange={onChange}
        />
        <TextField
          id={candidate.id}
          label="Vintage"
          field="vintage"
          type="number"
          value={candidate.vintage?.toString() ?? ""}
          onChange={onChange}
        />
        <div className="field">
          <label htmlFor={`${candidate.id}-color`}>Color</label>
          <select
            id={`${candidate.id}-color`}
            value={candidate.color}
            onChange={(event) =>
              onChange(candidate.id, "color", event.currentTarget.value)
            }
          >
            {colors.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </div>
        <TextField
          id={candidate.id}
          label="Region"
          field="region"
          value={candidate.region}
          onChange={onChange}
        />
        <TextField
          id={candidate.id}
          label="Country"
          field="country"
          value={candidate.country}
          onChange={onChange}
        />
        <TextField
          id={candidate.id}
          label="Appellation"
          field="appellation"
          value={candidate.appellation}
          onChange={onChange}
        />
        <TextField
          id={candidate.id}
          label="Varietal"
          field="varietal"
          value={candidate.varietal}
          onChange={onChange}
        />
        <TextareaField
          id={candidate.id}
          label="Uncertainty"
          field="uncertaintyNotes"
          value={candidate.uncertaintyNotes}
          onChange={onChange}
        />
        <TextareaField
          id={candidate.id}
          label="Raw label text"
          field="rawLabelText"
          value={candidate.rawLabelText}
          onChange={onChange}
        />
      </div>

      <div className="card-actions">
        <button
          className="button"
          type="button"
          onClick={() => onStatusChange(candidate.id, "confirmed")}
        >
          Confirm
        </button>
        <button
          className="button danger"
          type="button"
          onClick={() => onStatusChange(candidate.id, "rejected")}
        >
          Reject
        </button>
        <button
          className="button ghost"
          type="button"
          onClick={() => onStatusChange(candidate.id, "pending")}
        >
          Reset
        </button>
      </div>
    </article>
  );
}

function TextField({
  id,
  label,
  field,
  value,
  onChange,
  type = "text"
}: {
  id: string;
  label: string;
  field: keyof WineBottleCandidate;
  value: string | null;
  onChange: (id: string, field: keyof WineBottleCandidate, value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="field">
      <label htmlFor={`${id}-${field}`}>{label}</label>
      <input
        id={`${id}-${field}`}
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(id, field, event.currentTarget.value)}
      />
    </div>
  );
}

function TextareaField({
  id,
  label,
  field,
  value,
  onChange
}: {
  id: string;
  label: string;
  field: keyof WineBottleCandidate;
  value: string;
  onChange: (id: string, field: keyof WineBottleCandidate, value: string) => void;
}) {
  return (
    <div className="field full">
      <label htmlFor={`${id}-${field}`}>{label}</label>
      <textarea
        id={`${id}-${field}`}
        value={value}
        onChange={(event) => onChange(id, field, event.currentTarget.value)}
      />
    </div>
  );
}

function toEditableCandidate(
  candidate: WineBottleCandidate,
  id: string
): EditableCandidate {
  return {
    ...candidate,
    id,
    status: "pending"
  };
}

function stripCandidateState(candidate: EditableCandidate): WineBottleCandidate {
  const { id: _id, status: _status, ...bottle } = candidate;
  return bottle;
}

function displayWineName(bottle: WineBottleCandidate) {
  return [bottle.producer, bottle.name].filter(Boolean).join(" ") || "Unnamed wine";
}
