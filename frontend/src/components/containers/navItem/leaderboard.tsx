import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { getRankList } from "@/apis/apis";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface RankItem {
  name: string; // wallet address
  value: string; // score
}

const mockData: RankItem[] = [
  { name: "0x1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0t", value: "1000" },
  { name: "0x2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9s0T1", value: "800" },
  { name: "0x3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0t2A3", value: "600" },
  { name: "0x4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9s0T1B4C5", value: "200" },
  { name: "0x5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0t1A2B3C4", value: "1500" },
  { name: "0x6F7g8H9i0J1k2L3m4N5o6P7q8R9s0T1B2C3D4E5", value: "1200" },
  { name: "0x7G8h9I0j1K2l3M4n5O6p7Q8r9S0t1A2B3C4D5E6", value: "900" },
  { name: "0x8H9i0J1k2L3m4N5o6P7q8R9s0T1B2C3D4E5F6G7", value: "700" },
  { name: "0x9I0j1K2l3M4n5O6p7Q8r9S0t1A2B3C4D5E6F7G8", value: "500" },
  { name: "0x0J1k2L3m4N5o6P7q8R9s0T1B2C3D4E5F6G7H8I9", value: "300" },
  { name: "0x1K2l3M4n5O6p7Q8r9S0t1A2B3C4D5E6F7G8H9I0", value: "250" },
  { name: "0x2L3m4N5o6P7q8R9s0T1B2C3D4E5F6G7H8I9J0K1", value: "400" },
  { name: "0x7Q8r9S0t1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6", value: "750" },
  { name: "0x8R9s0T1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7", value: "850" },
  { name: "0x9S0t1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8", value: "950" },
  { name: "0x0T1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9", value: "1050" },
  { name: "0x1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0", value: "1150" },
  { name: "0x2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1", value: "1250" },
  { name: "0x3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1A2", value: "1350" },
  { name: "0x4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1A2B3", value: "1450" },
  { name: "0x5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1A2B3C4", value: "1550" },
  { name: "0x6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1A2B3C4D5", value: "1650" },
  { name: "0x7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1A2B3C4D5E6", value: "1750" },
  { name: "0x8H9I0J1K2L3M4N5O6P7Q8R9S0T1A2B3C4D5E6F7", value: "1850" },
  { name: "0x9I0J1K2L3M4N5O6P7Q8R9S0T1A2B3C4D5E6F7G8", value: "1950" },
  { name: "0x0J1K2L3M4N5O6P7Q8R9S0T1A2B3C4D5E6F7G8H9", value: "2050" },
];

const Leaderboard = () => {
  const [rankList, setRankList] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const client = useSuiClient();

  useEffect(() => {
    const fetchRankList = async () => {
      try {
        const stateObject = await client.getObject({
          id: process.env.NEXT_PUBLIC_CONTRACT_STATE_ID!,
          options: { showContent: true },
        });

        const scoreTableId = (stateObject.data?.content as any)?.fields?.score
          ?.fields?.id?.id;

        if (scoreTableId) {
          const rankData = await getRankList(scoreTableId);
          if (rankData && rankData.length > 0) {
            // 按分数降序排序
            const sortedData = rankData.sort(
              (a, b) => parseInt(b.value) - parseInt(a.value)
            );
            setRankList(sortedData);
          } else {
            const sortedData = mockData.sort(
              (a, b) => parseInt(b.value) - parseInt(a.value)
            );
            console.log("test", sortedData);

            setRankList(sortedData);
          }
        } else {
          setRankList(mockData);
        }
      } catch (error) {
        console.error("Error fetching rank list:", error);
        setRankList(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchRankList();
  }, [client]);

  const totalPages = Math.ceil(rankList.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentData = rankList.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getRankDisplay = (index: number) => {
    const rank = startIndex + index + 1;
    if (rank === 1) {
      return <img src="/images/first.png" alt="1st" width={42} height={42} />;
    } else if (rank === 2) {
      return <img src="/images/second.png" alt="2nd" width={42} height={42} />;
    } else if (rank === 3) {
      return <img src="/images/third.png" alt="3rd" width={42} height={42} />;
    } else {
      return (
        <div className="bg-gradient-to-r from-[#93FE0D] to-[#FFFF00] text-[#333] text-xs rounded-xl inline-block px-3 py-1">
          No. {rank}
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center mt-6">
        <svg
          className="animate-spin h-8 w-8"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <table className="min-w-full bg-white rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-6 py-3 text-left">Rank</th>
            <th className="px-6 py-3 text-left">Wallet Address</th>
            <th className="px-6 py-3 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {currentData.map((item, index) => (
            <tr key={item.name} className="border-b">
              <td className="px-6 py-4">{getRankDisplay(index)}</td>
              <td className="px-6 py-4">
                {item.name.slice(0, 6)}...{item.name.slice(-4)}
              </td>
              <td className="px-6 py-4 text-right">{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>entries</span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="px-4 py-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
