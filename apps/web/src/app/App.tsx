import { BrowserRouter, MemoryRouter, Route, Routes, useLocation, useParams } from "react-router";
import { useEffect } from "react";

import { AppShell } from "../components/AppShell";
import { NotFoundPage } from "../components/NotFoundPage";
import {
  AccountAuthRoute,
  AccountDeletionRoute,
  AccountEmailCodeRoute,
  AccountExperience,
  AccountForgotPasswordRoute,
  AccountOnboardingRoute,
  AccountPasswordResetRoute,
  AccountSettingsRoute,
  AccountTodayRoute,
  AccountWorkspaceRoute
} from "../features/account/AccountExperience";
import { AccountSessionProvider } from "../features/account/AccountSessionContext";
import { CurriculumPreviewPage } from "../features/curriculum/CurriculumPreviewPage";
import { PrivacyPage, SupportPage, TermsPage } from "../features/policy/PolicyPages";
import { WORKSPACE_PATHS } from "../features/workspace/WorkspaceExperience";

type AppProps = {
  pathname?: string;
};

function CurriculumRoute() {
  const { requestedDay } = useParams<"requestedDay">();
  return requestedDay === undefined ? (
    <CurriculumPreviewPage />
  ) : (
    <CurriculumPreviewPage requestedDay={requestedDay} />
  );
}

function RoutedApplication() {
  const location = useLocation();
  const privateMode = location.pathname.startsWith("/app/") || location.pathname === "/admin";
  const accountSessionEnabled =
    privateMode ||
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/reset-password" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/login/email-code";

  return (
    <AccountSessionProvider enabled={accountSessionEnabled}>
      <AppShell
        modeLabel={privateMode ? "Private mock-first workspace" : "Free local preview"}
        privateMode={privateMode}
      >
        <Routes>
          <Route path="curriculum/:requestedDay" element={<CurriculumRoute />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route element={<AccountExperience />}>
            <Route index element={null} />
            <Route path="register" element={<AccountAuthRoute mode="register" />} />
            <Route path="login" element={<AccountAuthRoute mode="login" />} />
            <Route path="login/email-code" element={<AccountEmailCodeRoute />} />
            <Route path="forgot-password" element={<AccountForgotPasswordRoute />} />
            <Route path="reset-password" element={<AccountPasswordResetRoute />} />
            <Route path="app/onboarding" element={<AccountOnboardingRoute />} />
            <Route path="app/today" element={<AccountTodayRoute />} />
            <Route path="app/account" element={<AccountSettingsRoute />} />
            <Route path="app/account/delete" element={<AccountDeletionRoute />} />
            {[...WORKSPACE_PATHS].map((workspacePath) => (
              <Route
                key={workspacePath}
                path={workspacePath.slice(1)}
                element={<AccountWorkspaceRoute pathname={workspacePath} />}
              />
            ))}
            <Route path="app/*" element={<NotFoundPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </AccountSessionProvider>
  );
}

function TestRoutedApplication() {
  const location = useLocation();

  useEffect(() => {
    window.history.replaceState(null, "", `${location.pathname}${location.search}${location.hash}`);
  }, [location]);

  return <RoutedApplication />;
}

export function App({ pathname }: AppProps) {
  if (pathname !== undefined) {
    return (
      <MemoryRouter initialEntries={[pathname]}>
        <TestRoutedApplication />
      </MemoryRouter>
    );
  }

  return (
    <BrowserRouter>
      <RoutedApplication />
    </BrowserRouter>
  );
}
