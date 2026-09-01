import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "../../i18n/I18nProvider";
import { Alert } from "./Alert";
import { Button } from "./Button";

function ErrorFallback() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Alert variant="error" title={t("error.title")}>
        <p>{t("error.body")}</p>
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
          >
            {t("error.reload")}
          </Button>
        </div>
      </Alert>
    </div>
  );
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}
