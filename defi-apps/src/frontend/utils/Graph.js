// Helper functions of bidirectional graph of supported tokens

export const addNode = (graph, token) => {
  graph.set(token.address, { token, neighbor: new Set() });
}

export const connectNodes = (graph, tokenA, tokenB) => {
  graph.get(tokenA.address).neighbor.add(tokenB.address);
  graph.get(tokenB.address).neighbor.add(tokenA.address);
}

export const buildGraphFromEdges = edges => edges.reduce(
  (graph, [tokenA, tokenB]) => {
    if (!graph.has(tokenA.address)) {
      addNode(graph, tokenA);
    }
    if (!graph.has(tokenB.address)) {
      addNode(graph, tokenB);
    }
    connectNodes(graph, tokenA, tokenB);
    return graph;
  }, new Map()
);

const dfs = (address1, address2, graph, visited, path, result) => {
  if (address1 === address2) {
    result.push([...path]);
    return;
  }
  visited.add(address1);
  for (const address of graph.get(address1).neighbor) {
    if (!visited[address] && !path.includes(address)) {
      path.push(address);
      dfs(address, address2, graph, visited, path, result);
      path.pop();
    }
  }
  visited.delete(address1);
}

export const findAllPaths = (address1, address2, graph) => {
  const path = [];
  if (!graph.has(address1) || !graph.has(address2)) {
    return path;
  }
  const visited = new Set();
  path.push(address1);
  const result = [];
  dfs(address1, address2, graph, visited, path, result);
  return result;
}