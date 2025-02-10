import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { graphql } from "@mysten/sui/graphql/schemas/2024.4";
import { SUI_GRAPHQL_URL } from "@/constants/rpcNodeList";

const gqlClient = new SuiGraphQLClient({
  url: SUI_GRAPHQL_URL,
});

export async function getRankList(tableId: string) {
  const query: any = graphql(`
    query {
      object(address: "${tableId}") {
        dynamicFields(first: 50) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name {
              json
            }
            value {
              ... on MoveValue {
                json
              }
            }
          }
        }
      }
    }
  `);

  let allNodes: any[] = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    const result = await gqlClient.query({
      query,
      variables: undefined,
    });

    const objectData = (result.data as any).object;
    if (!objectData) return null;

    const currentNodes = objectData.dynamicFields.nodes;
    allNodes = [...allNodes, ...currentNodes];

    hasNextPage = objectData.dynamicFields.pageInfo.hasNextPage || false;
    endCursor = objectData.dynamicFields.pageInfo.endCursor;
  }

  const rankData = allNodes.map((node) => {
    const nameJson = node.name as { json: { name: string } };
    const valueJson = node.value as { json: { value: string } };
    return {
      name: nameJson.json.name,
      value: valueJson.json.value,
    };
  });

  return rankData;
}

export async function getWatchList(tableId: string) {
  const query: any = graphql(`
    query {
      object(address: "${tableId}") {
        dynamicFields(first: 50) {
          nodes {
            name {
              json
            }
            value {
              ... on MoveValue {
                json
              }
            }
          }
        }
      }
    }
  `);

  let allNodes: any[] = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    const result = await gqlClient.query({
      query,
      variables: undefined,
    });

    const objectData = (result.data as any).object;
    if (!objectData) return null;

    const currentNodes = objectData.dynamicFields.nodes;
    allNodes = [...allNodes, ...currentNodes];

    hasNextPage = objectData.dynamicFields.pageInfo.hasNextPage || false;
    endCursor = objectData.dynamicFields.pageInfo.endCursor;
  }

  const watchListData = allNodes.map((node) => {
    const nameJson = node.name as { json: { name: string } };
    const valueJson = node.value as { json: { value: string } };
    return {
      name: nameJson.json.name,
      value: valueJson.json.value,
    };
  });

  return watchListData;
}

export async function getNavxBalance(walletAddress: string) {
  const query = `
    query {
      address(address: "${walletAddress}") {
        balance(
          type: "0xa99b8952d4f7d947ea77fe0ecdcc9e5fc0bcab2841d6e2a5aa00c3044e5544b5::navx::NAVX"
        ) {
          coinObjectCount
          totalBalance
        }
      }
    }
  `;

  const result = await gqlClient.query({
    query,
    variables: undefined,
  });

  const balanceData = (result.data as any).address.balance;
  if (!balanceData) return null;

  return {
    coinObjectCount: balanceData.coinObjectCount,
    totalBalance: balanceData.totalBalance / 1e9,
  };
}
