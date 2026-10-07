'use client'
import { Component, type ReactNode } from 'react'


export default class LimiteDeErro extends Component<
  { children: ReactNode; ancora: string },
  { quebrou: boolean }
> {
  state = { quebrou: false }

  static getDerivedStateFromError() {
    return { quebrou: true }
  }

  componentDidCatch(erro: unknown) {
    console.error('[custom/slot] falhou:', this.props.ancora, erro)
  }

  render() {
    return this.state.quebrou ? null : this.props.children
  }
}
