"use client";

import * as React from "react";

/**
 * Error boundary wrapping the right rail (and any other crash-prone panel)
 * inside the Generate Quote form.
 *
 * Why this exists: a single unguarded `.toLocaleString()` /  `.toFixed()`
 * on an undefined field inside the form's many tier / labour / truck
 * panels was unmounting the whole component and dumping the user into the
 * /admin/quotes segment-level error.tsx ("QUOTES FAILED TO LOAD" + Try
 * again / Dashboard). The toast already said "Quote YG-30322 generated"
 * — meaning the work succeeded server-side — but the operator had no
 * recovery path short of starting over because the entire form had
 * vaporised.
 *
 * Containing the crash here means:
 *   • Form inputs (left rail) stay mounted, so the operator's data isn't
 *     lost.
 *   • Right rail shows a clear failure card with the message + a button to
 *     reset the boundary and try re-rendering with the latest state.
 *   • The full error + component stack is logged to console with a tag
 *     so we can keep fixing the underlying field accesses without
 *     traumatising the operator each time.
 *
 * Pair with proactive null-safing on the obvious crash sites — but treat
 * this boundary as the bottom layer of defence, not a substitute for
 * fixing the data shape.
 *
 * Built 2026-06-27 after the second `Cannot read properties of undefined
 * (reading 'toLocaleString')` event-quote crash this week.
 */

type Props = {
  children: React.ReactNode;
  /** Label rendered above the recovery card so the operator knows which panel failed. */
  label?: string;
};

type State = { error: Error | null };

export default class QuoteFormErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[QuoteForm rail crash${this.props.label ? ` — ${this.props.label}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const message = this.state.error.message || "Unknown render error";
      return (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[12px] space-y-2">
          <p className="font-semibold text-amber-700 dark:text-amber-200">
            Right rail hit a snag rendering this quote
          </p>
          <p className="text-amber-800 dark:text-amber-200/90 leading-snug">
            Your form inputs are safe and your quote was likely generated.
            The right-side summary panel ran into:
          </p>
          <code className="block text-[10.5px] font-mono break-all bg-amber-500/10 rounded px-2 py-1">
            {message}
          </code>
          <p className="text-[11px] text-[var(--tx2)] leading-snug">
            Try regenerating, or refresh the page — your draft is saved on
            the server.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700"
          >
            Retry render
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
