"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AErrorState } from "./a-error-state";

type Props = {
  name: string;
  children: ReactNode;
};

type State = { error: Error | null };

/** Widget failure stays in the card — dashboard keeps running. */
export class AWidgetBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn(`widget ${this.props.name} failed`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <AErrorState
          title={`${this.props.name} indisponible`}
          message="Ce widget a échoué. Le reste du tableau de bord continue."
          detail={this.state.error.message}
          retryable
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
