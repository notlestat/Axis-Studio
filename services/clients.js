// services/clients.js
// Client configuration registry. Add a new entry here for each client.
// The key is the clientId sent in the form's hidden field.

const clients = {
  'axis-studio-test': {
    name: 'Axis Studio',
  },
};

/**
 * Look up a client config by ID.
 * Returns null if the clientId is unknown.
 */
export function getClient(clientId) {
  return clients[clientId] || null;
}
