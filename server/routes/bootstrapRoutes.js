import { createBootstrapService } from '../services/bootstrapService.js';

export const registerBootstrapRoutes = (app, deps) => {
  const { requireAuthUser } = deps;
  const bootstrapService = createBootstrapService(deps);

  app.get('/api/bootstrap', requireAuthUser, bootstrapService.handleBootstrap);
};
