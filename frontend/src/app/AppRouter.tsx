import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  AdminRoute,
  ProtectedRoute,
  StudentRoute,
  SuperAdminRoute,
} from "../routes";
import { RouteLoadingFallback } from "./RouteLoadingFallback";

const Home = lazy(() =>
  import("../pages/HomePage").then((module) => ({ default: module.Home })),
);
const Catalog = lazy(() =>
  import("../pages/CatalogPage").then((module) => ({
    default: module.Catalog,
  })),
);
const CourseDetail = lazy(() =>
  import("../pages/PublicPages").then((module) => ({
    default: module.CourseDetail,
  })),
);
const AuthPage = lazy(() =>
  import("../pages/AuthPage").then((module) => ({
    default: module.AuthPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("../pages/AuthRecoveryPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("../pages/AuthRecoveryPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const Profile = lazy(() =>
  import("../features/profile/ProfilePage").then((module) => ({
    default: module.Profile,
  })),
);
const Forbidden = lazy(() =>
  import("../pages/AccountPages").then((module) => ({
    default: module.Forbidden,
  })),
);
const UsersAdmin = lazy(() =>
  import("../pages/AccountPages").then((module) => ({
    default: module.UsersAdmin,
  })),
);
const StudentDashboard = lazy(() =>
  import("../pages/StudentPanel").then((module) => ({
    default: module.StudentDashboard,
  })),
);
const StudentCourseExplorer = lazy(() =>
  import("../pages/StudentCourseExplorer").then((module) => ({
    default: module.StudentCourseExplorer,
  })),
);
const StudentCalendar = lazy(() =>
  import("../pages/AcademicPages").then((module) => ({
    default: module.StudentCalendar,
  })),
);
const AcademicManagement = lazy(() =>
  import("../pages/AcademicPages").then((module) => ({
    default: module.AcademicManagement,
  })),
);
const StudentCourseworkPage = lazy(() =>
  import("../features/coursework/StudentCourseworkPage").then((module) => ({
    default: module.StudentCourseworkPage,
  })),
);
const PaymentCheckout = lazy(() =>
  import("../pages/PaymentsPage").then((module) => ({
    default: module.PaymentCheckout,
  })),
);
const Classroom = lazy(() =>
  import("../pages/Dashboards").then((module) => ({
    default: module.Classroom,
  })),
);
const AdminDashboard = lazy(() =>
  import("../pages/AdminPanel").then((module) => ({
    default: module.AdminDashboard,
  })),
);
const CoursesAdmin = lazy(() =>
  import("../features/courses/admin/CoursesAdminPage").then((module) => ({
    default: module.CoursesAdmin,
  })),
);
const CourseEditor = lazy(() =>
  import("../pages/CourseEditorPage").then((module) => ({
    default: module.CourseEditor,
  })),
);
const AdminSubmissionsPage = lazy(() =>
  import("../features/coursework/AdminSubmissionsPage").then((module) => ({
    default: module.AdminSubmissionsPage,
  })),
);
const StudentsAdmin = lazy(() =>
  import("../features/students/StudentsAdminPage").then((module) => ({
    default: module.StudentsAdmin,
  })),
);
const AdminPayments = lazy(() =>
  import("../pages/PaymentsPage").then((module) => ({
    default: module.AdminPayments,
  })),
);
const PaymentCorrections = lazy(() =>
  import("../pages/PaymentsPage").then((module) => ({
    default: module.PaymentCorrections,
  })),
);
const AccountingPage = lazy(() =>
  import("../features/accounting/AccountingPage").then((module) => ({
    default: module.AccountingPage,
  })),
);
const SystemManagementPage = lazy(() =>
  import("../features/management/SystemManagementPage").then((module) => ({
    default: module.SystemManagementPage,
  })),
);

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/courses" element={<Catalog />} />
      <Route path="/courses/:id" element={<CourseDetail />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<Profile />} />
        <Route path="/403" element={<Forbidden />} />
      </Route>

      <Route element={<StudentRoute />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/courses" element={<StudentCourseExplorer />} />
        <Route path="/student/calendar" element={<StudentCalendar />} />
        <Route path="/student/tasks" element={<StudentCourseworkPage />} />
        <Route
          path="/student/checkout/:courseId"
          element={<PaymentCheckout />}
        />
        <Route path="/classroom/:courseId" element={<Classroom />} />
      </Route>

      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/courses" element={<CoursesAdmin />} />
        <Route path="/admin/course-editor" element={<CourseEditor />} />
        <Route path="/admin/academic" element={<AcademicManagement />} />
        <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
        <Route path="/admin/students" element={<StudentsAdmin />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
        <Route path="/admin/accounting" element={<AccountingPage />} />
        <Route
          path="/admin/enrollments"
          element={<SystemManagementPage initialTab="enrollments" />}
        />
      </Route>

      <Route element={<SuperAdminRoute />}>
        <Route path="/super-admin" element={<AdminDashboard superAdmin />} />
        <Route path="/super-admin/users" element={<UsersAdmin />} />
        <Route
          path="/super-admin/payment-decisions"
          element={<PaymentCorrections />}
        />
        <Route
          path="/super-admin/settings"
          element={<SystemManagementPage initialTab="enrollments" />}
        />
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
