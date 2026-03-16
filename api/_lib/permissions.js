function parseRoleIds(value = "") {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function hasAnyRole(memberRoles = [], allowedRoles = []) {
  return allowedRoles.some((roleId) => memberRoles.includes(roleId));
}

function getRoleSets() {
  return {
    media: parseRoleIds(process.env.DISCORD_ALLOWED_ROLE_ID || ""),
    applicationCreate: parseRoleIds(process.env.DISCORD_APPLICATION_CREATOR_ROLE_ID || ""),
    applicationManage: parseRoleIds(process.env.DISCORD_APPLICATION_MANAGER_ROLE_ID || "")
  };
}

function getPermissionFlags({ isOwner = false, memberRoles = [] } = {}) {
  const roleSets = getRoleSets();

  return {
    media: isOwner || hasAnyRole(memberRoles, roleSets.media),
    applicationCreate: isOwner || hasAnyRole(memberRoles, roleSets.applicationCreate),
    applicationManage: isOwner || hasAnyRole(memberRoles, roleSets.applicationManage)
  };
}

function getPermissionConfig() {
  const roleSets = getRoleSets();

  return {
    mediaRoleConfigured: roleSets.media.length > 0,
    applicationCreatorConfigured: roleSets.applicationCreate.length > 0,
    applicationManagerConfigured: roleSets.applicationManage.length > 0,
    anyRoleConfigured: roleSets.media.length > 0 || roleSets.applicationCreate.length > 0 || roleSets.applicationManage.length > 0
  };
}

module.exports = {
  getPermissionConfig,
  getPermissionFlags,
  getRoleSets,
  hasAnyRole,
  parseRoleIds
};
