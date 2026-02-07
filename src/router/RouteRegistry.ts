/**
 * RouteRegistry - Route registration and lookup
 * Manages available routes with priority ordering
 */

import { InterfaceLogger } from '../interface/types.js';
import { ClassifiedIntent } from './types.js';
import { BaseRoute } from './routes/BaseRoute.js';

export class RouteRegistry {
  private routes: BaseRoute[] = [];
  private logger: InterfaceLogger;

  constructor(logger: InterfaceLogger) {
    this.logger = logger;
  }

  /** Register a route (order determines priority) */
  register(route: BaseRoute): void {
    this.routes.push(route);
    this.logger('info', `Route registered: ${route.name}`);
  }

  /** Unregister a route by name */
  unregister(name: string): void {
    const before = this.routes.length;
    this.routes = this.routes.filter((r) => r.name !== name);
    if (this.routes.length < before) {
      this.logger('info', `Route unregistered: ${name}`);
    }
  }

  /** Find the first route that can handle the intent */
  findRoute(intent: ClassifiedIntent): BaseRoute | null {
    for (const route of this.routes) {
      if (route.canHandle(intent)) {
        return route;
      }
    }
    return null;
  }

  /** Get all registered routes */
  getRoutes(): BaseRoute[] {
    return [...this.routes];
  }

  /** Get route count */
  get size(): number {
    return this.routes.length;
  }
}
