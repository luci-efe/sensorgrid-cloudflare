import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-64 gap-3 py-16">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Ocurrió un error al cargar este módulo.
          </p>
          <button
            className="px-3 py-1.5 rounded-md text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            onClick={() => this.setState({ hasError: false })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
