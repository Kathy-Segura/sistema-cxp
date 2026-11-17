"use client";
import { useState } from "react";
import { Check, Users } from "lucide-react";
import { FormField } from "./FormField";
export function ProfileContent() {
  const [saved, setSaved] = useState(false)
  return <><div className="section-heading"><div><div className="section-kicker"><Users size={14} /> CUENTA PERSONAL</div><h1>Mi perfil</h1><p className="page-subtitle">Administra tus datos personales y preferencias de cuenta.</p></div></div><form className="panel profile-panel" onSubmit={(event) => { event.preventDefault(); setSaved(true) }}><div className="profile-hero"><div className="avatar avatar-teal profile-avatar">MG</div><div><h2>María Gutiérrez</h2><p>Tesorería · Grupo Buen Sabor</p></div></div><div className="form-grid"><FormField label="Nombre completo" name="profile-name" required placeholder="María Gutiérrez" /><FormField label="Correo electrónico" name="profile-email" required type="email" placeholder="maria@grupobuensabor.com" /><FormField label="Cargo" name="profile-role" placeholder="Tesorería" /><FormField label="Teléfono" name="profile-phone" placeholder="+505 0000 0000" /></div><footer className="modal-footer"><span className="profile-saved" role="status">{saved ? "Perfil actualizado" : ""}</span><button type="submit" className="button-primary"><Check size={16} /> Guardar perfil</button></footer></form></>
}
