import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/pages/LoginPage.vue"),
    },
    {
      path: "/register",
      name: "register",
      component: () => import("@/pages/RegisterPage.vue"),
    },
    {
      path: "/",
      name: "kb-list",
      component: () => import("@/pages/KBListPage.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/kb/:id",
      name: "kb-detail",
      component: () => import("@/pages/KBDetailPage.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("@/pages/AdminPage.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const hasAuth = localStorage.getItem("refreshToken");
  if (to.meta.requiresAuth && !hasAuth) {
    next("/login");
  } else if ((to.path === "/login" || to.path === "/register") && hasAuth) {
    next("/");
  } else {
    next();
  }
});

export { router };
