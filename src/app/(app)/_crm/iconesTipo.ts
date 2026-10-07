import type { ComponentType } from 'react'
import { StickyNote, Phone, Mail, Users, Flag, CircleCheck, Sparkles, ArrowRight, Circle } from 'lucide-react'


export const ICONES: Record<string, ComponentType<{ size?: number }>> = {
  StickyNote, Phone, Mail, Users, Flag, CircleCheck, Sparkles, ArrowRight,
}


export function iconeDoTipo(icone: string): ComponentType<{ size?: number }> {
  return ICONES[icone] ?? Circle
}
