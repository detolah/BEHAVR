import React from 'react';

const ROLE_RANK = { agent:1, lead:2, csm:3, manager:4 };

export default function RoleGate({ minRole, userRole, children, fallback = null }) {
  return (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[minRole] || 0) ? children : fallback;
}
