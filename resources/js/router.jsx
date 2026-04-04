import { createRouter, createRoute, createRootRoute, redirect, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/toaster';

// Pages
import LoginPage from '@/pages/auth/Login';
import ProfilePage from '@/pages/auth/Profile';
import DashboardPage from '@/pages/dashboard/index';
import ApplicationsPage from '@/pages/applications/index';
import EditApplicationPage from '@/pages/applications/edit';
import MonitorApplicationPage from '@/pages/applications/monitor';
import UsersPage from '@/pages/users/index';
import EditUserPage from '@/pages/users/edit';
import PlaygroundPage from '@/pages/playground/index';
import GalleriesPage from '@/pages/galleries/index';
import GalleriesChatPage from '@/pages/galleries/chat';
import GalleriesChessPage from '@/pages/galleries/chess';
import GalleriesTienLenPage from '@/pages/galleries/tienlen';
import ClientDocPage from '@/pages/documentation/client';
import ServerDocPage from '@/pages/documentation/server';

function isAuthenticated() {
    return !!localStorage.getItem('token');
}

// Root route — renders Outlet + Toaster
const rootRoute = createRootRoute({
    component: () => (
        <>
            <Outlet />
            <Toaster />
        </>
    ),
});

// Auth guard helper
const requireAuth = () => {
    if (!isAuthenticated()) throw redirect({ to: '/login' });
};

// Public routes
const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: LoginPage,
    beforeLoad: () => {
        if (isAuthenticated()) throw redirect({ to: '/' });
    },
});

// Protected routes
const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: DashboardPage,
    beforeLoad: requireAuth,
});

const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/profile',
    component: ProfilePage,
    beforeLoad: requireAuth,
});

const applicationsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/applications',
    component: ApplicationsPage,
    beforeLoad: requireAuth,
});

const editApplicationRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/applications/$id/edit',
    component: EditApplicationPage,
    beforeLoad: requireAuth,
});

const monitorApplicationRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/applications/$id/monitor',
    component: MonitorApplicationPage,
    beforeLoad: requireAuth,
});

const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users',
    component: UsersPage,
    beforeLoad: requireAuth,
});

const editUserRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users/$id/edit',
    component: EditUserPage,
    beforeLoad: requireAuth,
});

const playgroundRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/playground',
    component: PlaygroundPage,
    beforeLoad: requireAuth,
});

const galleriesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/galleries',
    component: GalleriesPage,
    beforeLoad: requireAuth,
});

const galleriesChatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/galleries/chat',
    component: GalleriesChatPage,
    beforeLoad: requireAuth,
});

const galleriesChessRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/galleries/chess',
    component: GalleriesChessPage,
    beforeLoad: requireAuth,
});

const galleriesTienLenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/galleries/tienlen',
    component: GalleriesTienLenPage,
    beforeLoad: requireAuth,
});

const clientDocRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/documentation/client',
    component: ClientDocPage,
    beforeLoad: requireAuth,
});

const serverDocRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/documentation/server',
    component: ServerDocPage,
    beforeLoad: requireAuth,
});

const routeTree = rootRoute.addChildren([
    loginRoute,
    dashboardRoute,
    profileRoute,
    applicationsRoute,
    editApplicationRoute,
    monitorApplicationRoute,
    usersRoute,
    editUserRoute,
    playgroundRoute,
    galleriesRoute,
    galleriesChatRoute,
    galleriesChessRoute,
    galleriesTienLenRoute,
    clientDocRoute,
    serverDocRoute,
]);

export const router = createRouter({ routeTree });
