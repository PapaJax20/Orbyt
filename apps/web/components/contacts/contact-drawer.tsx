"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@orbyt/api";

type RouterOutput = inferRouterOutputs<AppRouter>;
type ContactDetail = NonNullable<RouterOutput["contacts"]["getById"]>;

// ── Constants ─────────────────────────────────────────────────────────────────

const RELATIONSHIP_TYPES = [
  "spouse", "partner", "child", "parent", "sibling", "extended_family",
  "friend", "doctor", "teacher", "neighbor", "colleague", "service_provider", "other",
] as const;
type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

function labelRelationship(r: string) {
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Contact Form Fields (shared between create and edit) ──────────────────────

function ContactFormFields({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  relationshipType,
  setRelationshipType,
  phone,
  setPhone,
  email,
  setEmail,
  birthday,
  setBirthday,
  anniversary,
  setAnniversary,
  notes,
  setNotes,
  showNotes,
  street,
  setStreet,
  city,
  setCity,
  state,
  setState,
  zip,
  setZip,
  showSocial,
  setShowSocial,
  instagram,
  setInstagram,
  twitter,
  setTwitter,
  linkedin,
  setLinkedin,
  facebook,
  setFacebook,
  website,
  setWebsite,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  relationshipType: RelationshipType;
  setRelationshipType: (v: RelationshipType) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  birthday: string;
  setBirthday: (v: string) => void;
  anniversary: string;
  setAnniversary: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  showNotes: boolean;
  street: string;
  setStreet: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  zip: string;
  setZip: (v: string) => void;
  showSocial: boolean;
  setShowSocial: (v: boolean) => void;
  instagram: string;
  setInstagram: (v: string) => void;
  twitter: string;
  setTwitter: (v: string) => void;
  linkedin: string;
  setLinkedin: (v: string) => void;
  facebook: string;
  setFacebook: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-6">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="orbyt-label" htmlFor="c-first">First Name</label>
          <input id="c-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
            className="orbyt-input mt-1 w-full" required maxLength={100} autoFocus />
        </div>
        <div>
          <label className="orbyt-label" htmlFor="c-last">Last Name</label>
          <input id="c-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
            className="orbyt-input mt-1 w-full" maxLength={100} />
        </div>
      </div>

      {/* Relationship */}
      <div>
        <label className="orbyt-label" htmlFor="c-rel">Relationship</label>
        <select id="c-rel" value={relationshipType}
          onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
          className="orbyt-input mt-1 w-full">
          {RELATIONSHIP_TYPES.map((r) => (
            <option key={r} value={r}>{labelRelationship(r)}</option>
          ))}
        </select>
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="orbyt-label" htmlFor="c-phone">Phone</label>
          <input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="orbyt-input mt-1 w-full" placeholder="(555) 123-4567" />
        </div>
        <div>
          <label className="orbyt-label" htmlFor="c-email">Email</label>
          <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="orbyt-input mt-1 w-full" />
        </div>
      </div>

      {/* Birthday + Anniversary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="orbyt-label" htmlFor="c-bday">Birthday</label>
          <input id="c-bday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)}
            className="orbyt-input mt-1 w-full" />
        </div>
        <div>
          <label className="orbyt-label" htmlFor="c-ann">Anniversary</label>
          <input id="c-ann" type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)}
            className="orbyt-input mt-1 w-full" />
        </div>
      </div>

      {/* Address */}
      <div>
        <p className="orbyt-label mb-2">Address</p>
        <div className="grid grid-cols-1 gap-2">
          <input type="text" value={street} onChange={(e) => setStreet(e.target.value)}
            className="orbyt-input w-full" placeholder="Street" maxLength={200} aria-label="Street" />
          <div className="grid grid-cols-3 gap-2">
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
              className="orbyt-input col-span-1 w-full" placeholder="City" maxLength={100} aria-label="City" />
            <input type="text" value={state} onChange={(e) => setState(e.target.value)}
              className="orbyt-input w-full" placeholder="State" maxLength={100} aria-label="State" />
            <input type="text" value={zip} onChange={(e) => setZip(e.target.value)}
              className="orbyt-input w-full" placeholder="ZIP" maxLength={20} aria-label="ZIP" />
          </div>
        </div>
      </div>

      {/* Social Links (collapsible) */}
      <div>
        <button type="button" onClick={() => setShowSocial(!showSocial)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-surface/30 px-4 py-3 text-sm font-medium text-text">
          Social Links
          {showSocial ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showSocial && (
          <div className="mt-2 grid grid-cols-1 gap-2">
            {[
              { label: "Instagram", value: instagram, set: setInstagram, placeholder: "@username" },
              { label: "Twitter/X", value: twitter, set: setTwitter, placeholder: "@handle" },
              { label: "LinkedIn", value: linkedin, set: setLinkedin, placeholder: "https://linkedin.com/in/..." },
              { label: "Facebook", value: facebook, set: setFacebook, placeholder: "" },
              { label: "Website", value: website, set: setWebsite, placeholder: "https://" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="orbyt-label text-xs">{label}</label>
                <input type="text" value={value} onChange={(e) => set(e.target.value)}
                  className="orbyt-input mt-0.5 w-full text-sm" placeholder={placeholder} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {showNotes && (
        <div>
          <label className="orbyt-label" htmlFor="c-notes">Notes</label>
          <textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="orbyt-input mt-1 w-full resize-none" rows={3} maxLength={10000} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button type="submit" disabled={isPending || !firstName.trim()}
          className="orbyt-button-accent flex-1">
          {isPending ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="orbyt-button-ghost flex-1">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateContactForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("friend");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [notes, setNotes] = useState("");
  // Address
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  // Social
  const [showSocial, setShowSocial] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [facebook, setFacebook] = useState("");
  const [website, setWebsite] = useState("");

  const create = trpc.contacts.create.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      utils.contacts.getUpcomingBirthdays.invalidate();
      toast.success("Contact added");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to add contact");
    },
  });

  function buildAddress() {
    const addr: Record<string, string> = {};
    if (street.trim()) addr.street = street.trim();
    if (city.trim()) addr.city = city.trim();
    if (state.trim()) addr.state = state.trim();
    if (zip.trim()) addr.zip = zip.trim();
    return addr;
  }

  function buildSocialLinks() {
    const links: Record<string, string> = {};
    if (instagram.trim()) links.instagram = instagram.trim();
    if (twitter.trim()) links.twitter = twitter.trim();
    if (linkedin.trim()) links.linkedin = linkedin.trim();
    if (facebook.trim()) links.facebook = facebook.trim();
    if (website.trim()) links.website = website.trim();
    return links;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      relationshipType,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: buildAddress(),
      birthday: birthday || null,
      anniversary: anniversary || null,
      notes: notes.trim() || null,
      socialLinks: buildSocialLinks(),
    });
  }

  return (
    <ContactFormFields
      firstName={firstName}
      setFirstName={setFirstName}
      lastName={lastName}
      setLastName={setLastName}
      relationshipType={relationshipType}
      setRelationshipType={setRelationshipType}
      phone={phone}
      setPhone={setPhone}
      email={email}
      setEmail={setEmail}
      birthday={birthday}
      setBirthday={setBirthday}
      anniversary={anniversary}
      setAnniversary={setAnniversary}
      notes={notes}
      setNotes={setNotes}
      showNotes={true}
      street={street}
      setStreet={setStreet}
      city={city}
      setCity={setCity}
      state={state}
      setState={setState}
      zip={zip}
      setZip={setZip}
      showSocial={showSocial}
      setShowSocial={setShowSocial}
      instagram={instagram}
      setInstagram={setInstagram}
      twitter={twitter}
      setTwitter={setTwitter}
      linkedin={linkedin}
      setLinkedin={setLinkedin}
      facebook={facebook}
      setFacebook={setFacebook}
      website={website}
      setWebsite={setWebsite}
      submitLabel="Add Contact"
      isPending={create.isPending}
      onSubmit={handleSubmit}
    />
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────────

function EditContactForm({
  contact,
  onCancel,
}: {
  contact: ContactDetail;
  onCancel: () => void;
}) {
  const utils = trpc.useUtils();

  const addr = contact.address as Record<string, string> | null | undefined;
  const social = contact.socialLinks as Record<string, string> | null | undefined;

  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName ?? "");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(
    contact.relationshipType as RelationshipType,
  );
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [birthday, setBirthday] = useState(contact.birthday ?? "");
  const [anniversary, setAnniversary] = useState(contact.anniversary ?? "");
  // Address
  const [street, setStreet] = useState(addr?.street ?? "");
  const [city, setCity] = useState(addr?.city ?? "");
  const [state, setState] = useState(addr?.state ?? "");
  const [zip, setZip] = useState(addr?.zip ?? "");
  // Social
  const [showSocial, setShowSocial] = useState(
    !!(social && Object.values(social).some((v) => v)),
  );
  const [instagram, setInstagram] = useState(social?.instagram ?? "");
  const [twitter, setTwitter] = useState(social?.twitter ?? "");
  const [linkedin, setLinkedin] = useState(social?.linkedin ?? "");
  const [facebook, setFacebook] = useState(social?.facebook ?? "");
  const [website, setWebsite] = useState(social?.website ?? "");

  const update = trpc.contacts.update.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      utils.contacts.getById.invalidate({ id: contact.id });
      utils.contacts.getUpcomingBirthdays.invalidate();
      toast.success("Contact updated");
      onCancel(); // Switch back to view mode
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update contact");
    },
  });

  function buildAddress() {
    const addrObj: Record<string, string> = {};
    if (street.trim()) addrObj.street = street.trim();
    if (city.trim()) addrObj.city = city.trim();
    if (state.trim()) addrObj.state = state.trim();
    if (zip.trim()) addrObj.zip = zip.trim();
    return addrObj;
  }

  function buildSocialLinks() {
    const links: Record<string, string> = {};
    if (instagram.trim()) links.instagram = instagram.trim();
    if (twitter.trim()) links.twitter = twitter.trim();
    if (linkedin.trim()) links.linkedin = linkedin.trim();
    if (facebook.trim()) links.facebook = facebook.trim();
    if (website.trim()) links.website = website.trim();
    return links;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      id: contact.id,
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        relationshipType,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: buildAddress(),
        birthday: birthday || null,
        anniversary: anniversary || null,
        socialLinks: buildSocialLinks(),
      },
    });
  }

  return (
    <ContactFormFields
      firstName={firstName}
      setFirstName={setFirstName}
      lastName={lastName}
      setLastName={setLastName}
      relationshipType={relationshipType}
      setRelationshipType={setRelationshipType}
      phone={phone}
      setPhone={setPhone}
      email={email}
      setEmail={setEmail}
      birthday={birthday}
      setBirthday={setBirthday}
      anniversary={anniversary}
      setAnniversary={setAnniversary}
      notes=""
      setNotes={() => {}}
      showNotes={false}
      street={street}
      setStreet={setStreet}
      city={city}
      setCity={setCity}
      state={state}
      setState={setState}
      zip={zip}
      setZip={setZip}
      showSocial={showSocial}
      setShowSocial={setShowSocial}
      instagram={instagram}
      setInstagram={setInstagram}
      twitter={twitter}
      setTwitter={setTwitter}
      linkedin={linkedin}
      setLinkedin={setLinkedin}
      facebook={facebook}
      setFacebook={setFacebook}
      website={website}
      setWebsite={setWebsite}
      submitLabel="Save Changes"
      isPending={update.isPending}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
}

// ── View Contact ──────────────────────────────────────────────────────────────

function ViewContact({
  contact,
  onClose,
  onEdit,
}: {
  contact: ContactDetail;
  onClose: () => void;
  onEdit: () => void;
}) {
  const utils = trpc.useUtils();
  const [showDelete, setShowDelete] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));

  const deleteContact = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      utils.contacts.getUpcomingBirthdays.invalidate();
      toast.success("Contact deleted");
      onClose();
    },
    onError: (err) => toast.error(err.message ?? "Failed to delete contact"),
  });

  const addNote = trpc.contacts.addNote.useMutation({
    onSuccess: () => {
      utils.contacts.getById.invalidate({ id: contact.id });
      toast.success("Note added");
      setNoteContent("");
    },
    onError: (err) => toast.error(err.message ?? "Failed to add note"),
  });

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    addNote.mutate({
      contactId: contact.id,
      content: noteContent.trim(),
      noteDate: new Date(noteDate + "T12:00:00.000Z").toISOString(),
    });
  }

  const addr = contact.address as Record<string, string> | null | undefined;
  const social = contact.socialLinks as Record<string, string> | null | undefined;
  const formattedAddress = addr
    ? [addr.street, [addr.city, addr.state, addr.zip].filter(Boolean).join(", ")].filter(Boolean).join("\n")
    : null;

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-white">
            {contact.firstName.charAt(0)}{contact.lastName?.charAt(0) ?? ""}
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-text">
              {contact.firstName} {contact.lastName}
            </h3>
            <p className="text-sm capitalize text-text-muted">
              {labelRelationship(contact.relationshipType)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex gap-2 text-text hover:text-accent">
              📞 {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex gap-2 text-text hover:text-accent">
              ✉️ {contact.email}
            </a>
          )}
          {contact.birthday && (
            <p className="flex gap-2 text-text-muted">
              🎂 {new Date(contact.birthday + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          {formattedAddress && (
            <p className="flex gap-2 whitespace-pre-line text-text-muted">📍 {formattedAddress}</p>
          )}
        </div>
        {social && Object.keys(social).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(social).map(([key, val]) => val ? (
              <a key={key} href={val.startsWith("http") ? val : `https://${val}`}
                target="_blank" rel="noopener noreferrer"
                className="rounded-full bg-surface px-3 py-1 text-xs text-accent hover:underline">
                {key}
              </a>
            ) : null)}
          </div>
        )}
      </div>

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="orbyt-button-ghost flex items-center justify-center gap-2"
      >
        <Pencil className="h-4 w-4" />
        Edit Contact
      </button>

      {/* Notes timeline */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Notes</p>
        {contact.notes.length === 0 ? (
          <p className="mb-3 text-sm text-text-muted">No notes yet.</p>
        ) : (
          <div className="mb-4 flex flex-col gap-3">
            {contact.notes.map((note) => (
              <div key={note.id} className="glass-card-subtle rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                    {(note.profile?.displayName ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <span>{note.profile?.displayName ?? "Unknown"}</span>
                  <span>·</span>
                  <span>{new Date(note.noteDate ?? note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <p className="mt-1.5 text-sm text-text">{note.content}</p>
              </div>
            ))}
          </div>
        )}
        {/* Add note form */}
        <form onSubmit={handleAddNote} className="flex flex-col gap-2">
          <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)}
            className="orbyt-input w-full resize-none" rows={2} placeholder="Add a note..."
            maxLength={10000} aria-label="Note content" />
          <div className="flex gap-2">
            <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)}
              className="orbyt-input flex-1" aria-label="Note date" />
            <button type="submit" disabled={addNote.isPending || !noteContent.trim()}
              className="orbyt-button-accent text-sm">
              {addNote.isPending ? "Adding..." : "Add Note"}
            </button>
          </div>
        </form>
      </div>

      {/* Delete */}
      <button onClick={() => setShowDelete(true)}
        className="orbyt-button-ghost flex items-center gap-2 text-red-400 hover:bg-red-500/10 text-sm">
        🗑 Delete Contact
      </button>

      <ConfirmDialog
        open={showDelete}
        title="Delete this contact?"
        description="This will permanently delete the contact and all their notes."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteContact.mutate({ id: contact.id })}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}

// ── ContactDrawer (main export) ───────────────────────────────────────────────

interface ContactDrawerProps {
  contactId: string | null;
  open: boolean;
  onClose: () => void;
}

export function ContactDrawer({ contactId, open, onClose }: ContactDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { data: contact, isLoading } = trpc.contacts.getById.useQuery(
    { id: contactId! },
    { enabled: !!contactId },
  );

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const title = contactId
    ? isEditing
      ? "Edit Contact"
      : contact ? `${contact.firstName} ${contact.lastName ?? ""}`.trim() : "Contact"
    : "Add Contact";

  return (
    <Drawer open={open} onClose={handleClose} title={title}>
      {contactId ? (
        isLoading ? (
          <div className="flex flex-col gap-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : contact ? (
          isEditing ? (
            <EditContactForm
              contact={contact}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <ViewContact
              contact={contact}
              onClose={handleClose}
              onEdit={() => setIsEditing(true)}
            />
          )
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">Contact not found.</p>
        )
      ) : (
        <CreateContactForm onClose={handleClose} />
      )}
    </Drawer>
  );
}
