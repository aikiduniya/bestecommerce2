import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffPage,
});

const PERMISSIONS = [
  { key: "catalog", label: "Catalog", hint: "Products, categories, collections, brands, media" },
  { key: "orders", label: "Orders", hint: "View and update orders, COD collection" },
  { key: "customers", label: "Customers", hint: "Customer list" },
] as const;

function StaffPage() {
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["staff_roles"], queryFn: async () => (await supabase.from("staff_roles").select("*").order("name")).data ?? [] });
  const members = useQuery({
    queryKey: ["staff_members"],
    queryFn: async () => {
      const [{ data: m }, { data: r }] = await Promise.all([
        supabase.from("staff_members").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role").in("role", ["admin", "staff"]),
      ]);
      return (m ?? []).map((x) => ({ ...x, role: (r ?? []).find((y) => y.user_id === x.user_id && y.role === "admin") ? "admin" : "staff" }));
    },
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [roleId, setRoleId] = useState("");
  const [newRole, setNewRole] = useState("");

  const refresh = () => { qc.invalidateQueries({ queryKey: ["staff_members"] }); qc.invalidateQueries({ queryKey: ["staff_roles"] }); };

  async function setStaff(e: string, r: string, rid: string | null, active: boolean, msg: string) {
    if (r === "admin" && !confirm(`Give ${e} full Super Admin access? They will be able to manage staff, settings and payments.`)) return;
    const { error } = await supabase.rpc("admin_set_staff", { _email: e, _role: r, _staff_role_id: rid as string, _active: active });
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    refresh();
  }

  async function addRole(ev: React.FormEvent) {
    ev.preventDefault();
    if (!newRole.trim()) return;
    const { error } = await supabase.from("staff_roles").insert({ name: newRole.trim(), permissions: [] });
    if (error) { toast.error(error.message); return; }
    setNewRole("");
    refresh();
  }

  async function togglePerm(id: string, perms: string[], key: string) {
    const next = perms.includes(key) ? perms.filter((p) => p !== key) : [...perms, key];
    const { error } = await supabase.from("staff_roles").update({ permissions: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function deleteRole(id: string, name: string) {
    if (!confirm(`Delete role "${name}"? Staff with this role lose its permissions.`)) return;
    const { error } = await supabase.from("staff_roles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <>
      <PageHeader title="Staff & roles" subtitle="Only the Super Admin can add staff or change permissions. The person must sign up first." />
      <Card className="mb-8 p-6">
        <h2 className="mb-4 font-display text-2xl">Add or update staff</h2>
        <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); if (!email.trim()) return; void setStaff(email, role, role === "staff" ? roleId || null : null, true, "Staff access saved").then(() => setEmail("")); }}>
          <Input className="min-w-60 flex-1" type="email" placeholder="Account email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select aria-label="Access level" className="h-9 rounded-md border bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as "staff" | "admin")}>
            <option value="staff">Staff</option><option value="admin">Super Admin</option>
          </select>
          {role === "staff" && (
            <select aria-label="Staff role" className="h-9 rounded-md border bg-background px-3 text-sm" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">No permissions yet</option>
              {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          <Button variant="gold" type="submit">Save access</Button>
        </form>
      </Card>

      <Card className="mb-8 p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Access</TableHead><TableHead>Role</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(members.data ?? []).map((m) => (
              <TableRow key={m.user_id}>
                <TableCell>{m.email}</TableCell>
                <TableCell className="text-xs uppercase">{m.role === "admin" ? "Super Admin" : "Staff"}</TableCell>
                <TableCell>
                  {m.role === "staff" ? (
                    <select aria-label={`Role for ${m.email}`} className="h-8 rounded border bg-background px-2 text-xs" value={m.staff_role_id ?? ""} onChange={(e) => setStaff(m.email, "staff", e.target.value || null, m.is_active, "Role updated")}>
                      <option value="">No permissions</option>
                      {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  ) : <span className="text-xs text-muted-foreground">All permissions</span>}
                </TableCell>
                <TableCell>{m.role === "staff" && <Switch checked={m.is_active} onCheckedChange={(v) => setStaff(m.email, "staff", m.staff_role_id, v, v ? "Access enabled" : "Access disabled")} aria-label="Active" />}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => confirm(`Remove all admin access for ${m.email}?`) && setStaff(m.email, "customer", null, false, "Access removed")}>Remove access</Button></TableCell>
              </TableRow>
            ))}
            {(members.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No staff yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display text-2xl">Custom roles</h2>
        <form onSubmit={addRole} className="mb-6 flex gap-3">
          <Input placeholder="New role name" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <Button type="submit" variant="outline">Add role</Button>
        </form>
        <div className="divide-y">
          {(roles.data ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 py-4">
              <p className="min-w-40 font-medium">{r.name}</p>
              <div className="flex flex-1 flex-wrap gap-2">
                {PERMISSIONS.map((p) => (
                  <button key={p.key} type="button" title={p.hint} onClick={() => togglePerm(r.id, r.permissions, p.key)}
                    className={`rounded-full border px-3 py-1 text-xs ${r.permissions.includes(p.key) ? "border-primary bg-primary text-primary-foreground" : ""}`}>{p.label}</button>
                ))}
              </div>
              <Button size="icon" variant="ghost" aria-label="Delete role" onClick={() => deleteRole(r.id, r.name)}><Trash2 /></Button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Settings, shipping, payments, staff and activity logs are always Super Admin only.</p>
      </Card>
    </>
  );
}
