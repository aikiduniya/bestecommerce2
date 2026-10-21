import { useRef, useState } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notifyContactInquiry } from "@/lib/smtp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().max(40).regex(/^[0-9+()\-\s]*$/, "Phone may only contain numbers, spaces and + - ( )"),
  subject: z.string().trim().max(150),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(5000),
});
type Form = z.infer<typeof schema>;

export function ContactForm() {
  const [f, setF] = useState<Form>({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const honey = useRef<HTMLInputElement>(null);
  const started = useRef(Date.now());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerErr("");
    const r = schema.safeParse(f);
    if (!r.success) {
      setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrs({});
    // Spam protection: hidden field must stay empty and humans take a few seconds.
    if (honey.current?.value || Date.now() - started.current < 2500) { setDone(true); return; }
    setBusy(true);
    const { data: id, error } = await supabase.rpc("submit_contact", { _name: r.data.name, _email: r.data.email, _phone: r.data.phone, _subject: r.data.subject, _message: r.data.message });
    setBusy(false);
    if (error) { setServerErr(error.message.replace(/^.*?: /, "") || "Could not send — please try again"); return; }
    if (id) void notifyContactInquiry({ data: { id } }).catch(() => undefined);
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded border bg-card p-10 text-center" role="status">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-4 text-3xl">Thank you — message received</h2>
        <p className="mt-2 text-sm text-muted-foreground">Our team will reply to {f.email || "you"} as soon as possible.</p>
      </div>
    );
  }
  const field = (k: keyof Form, label: string, el: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={`c-${k}`}>{label}</Label>
      {el}
      {errs[k] && <p className="text-xs text-destructive">{errs[k]}</p>}
    </div>
  );
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded border bg-card p-6 md:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Your name *", <Input id="c-name" value={f.name} onChange={set("name")} maxLength={100} autoComplete="name" />)}
        {field("email", "Email *", <Input id="c-email" type="email" value={f.email} onChange={set("email")} maxLength={255} autoComplete="email" />)}
        {field("phone", "Phone", <Input id="c-phone" value={f.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" />)}
        {field("subject", "Subject", <Input id="c-subject" value={f.subject} onChange={set("subject")} maxLength={150} />)}
      </div>
      {field("message", "Message *", <Textarea id="c-message" rows={6} value={f.message} onChange={set("message")} maxLength={5000} />)}
      <input ref={honey} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {serverErr && <p className="text-sm text-destructive">{serverErr}</p>}
      <Button type="submit" variant="gold" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send message</Button>
    </form>
  );
}
