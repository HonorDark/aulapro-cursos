import { Navigate, Route, Routes } from "react-router-dom";
import {
  AdminRoute,
  ProtectedRoute,
  StudentRoute,
  SuperAdminRoute,
} from "../routes";
import { AcademicManagement, StudentCalendar } from "../pages/AcademicPages";
import { Forbidden, Profile, UsersAdmin } from "../pages/AccountPages";
import { AdminDashboard } from "../pages/AdminPanel";
import { AuthPage } from "../pages/AuthPage";
import { Catalog } from "../pages/CatalogPage";
import { CourseEditor } from "../pages/CourseEditorPage";
import { Classroom } from "../pages/Dashboards";
import { CoursesAdmin } from "../features/courses/admin/CoursesAdminPage";
import { Home } from "../pages/HomePage";
import {
  AdminPayments,
  PaymentCheckout,
  PaymentCorrections,
} from "../pages/PaymentsPage";
import { CourseDetail } from "../pages/PublicPages";
import { StudentCourseExplorer } from "../pages/StudentCourseExplorer";
import { StudentDashboard } from "../pages/StudentPanel";
import { StudentsAdmin } from "../features/students/StudentsAdminPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/courses" element={<Catalog />} />
      <Route path="/courses/:id" element={<CourseDetail />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<Profile />} />
        <Route path="/403" element={<Forbidden />} />
      </Route>

      <Route element={<StudentRoute />}>
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/courses" element={<StudentCourseExplorer />} />
        <Route path="/student/calendar" element={<StudentCalendar />} />
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
        <Route path="/admin/students" element={<StudentsAdmin />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
      </Route>

      <Route element={<SuperAdminRoute />}>
        <Route path="/super-admin" element={<AdminDashboard superAdmin />} />
        <Route path="/super-admin/users" element={<UsersAdmin />} />
        <Route
          path="/super-admin/payment-decisions"
          element={<PaymentCorrections />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
