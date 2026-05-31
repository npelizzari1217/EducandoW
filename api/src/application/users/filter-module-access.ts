export interface ModuleAccessItem {
  moduleCode: string;
  actions: string[];
}

/**
 * Intersects the requested module access against the creator's allowed modules.
 * Only returns modules and actions that exist in BOTH arrays.
 *
 * - If requested is undefined/null/empty → returns []
 * - If creatorModules is undefined/null/empty → returns []
 * - Only includes modules where moduleCode exists in creatorModules
 * - Only includes actions present in the creator's module
 */
export function filterModuleAccess(
  requested: ModuleAccessItem[],
  creatorModules: ModuleAccessItem[],
): ModuleAccessItem[] {
  if (!requested || requested.length === 0) return [];
  if (!creatorModules || creatorModules.length === 0) return [];

  return requested
    .map((req) => {
      const creatorModule = creatorModules.find((cm) => cm.moduleCode === req.moduleCode);
      if (!creatorModule) return null;
      const allowedActions = req.actions.filter((a) => creatorModule.actions.includes(a));
      if (allowedActions.length === 0) return null;
      return { moduleCode: req.moduleCode, actions: allowedActions };
    })
    .filter((item): item is ModuleAccessItem => item !== null);
}
