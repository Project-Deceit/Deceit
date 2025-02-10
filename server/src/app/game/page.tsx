'use client';

import { useState, useEffect } from 'react';
import { Button, Card, List, Avatar, notification, Spin, Modal, Form, Input } from 'antd';
import { AgentListItem, Player, GameEvent, RoomView, AgentGameStatus } from '../../types';

const DEFAULT_AVATAR = 'https://img.alicdn.com/imgextra/i6/O1CN01yCnY2D1YS9kn1IyLJ_!!6000000003057-0-tps-300-300.jpg';

interface WebAgent extends AgentListItem {
    winningRate: number;
}

export default function GamePage() {
  const [api, contextHolder] = notification.useNotification();
  const [agents, setAgents] = useState<WebAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<AgentGameStatus>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomView | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  // 获取Agent列表
  const fetchAgents = async () => {
    try {
      // 先初始化测试数据
      await fetch('/api/agent/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const response = await fetch('/api/agent/list');
      const data = await response.json();
      if (data.info.ok) {
        // 转换数据格式，添加winningRate字段
        const webAgents: WebAgent[] = data.data.result.map((agent: AgentListItem) => ({
          ...agent,
          winningRate: agent.gameCount > 0 ? agent.winCount / agent.gameCount : 0
        }));
        setAgents(webAgents);
      } else {
        throw new Error(data.info.msg || 'get agent list failed');
      }
    } catch (err) {
      console.error('获取Agent列表失败:', err);
      api.error({
        message: 'get agent list failed',
        description: 'get agent list failed, please try again later'
      });
    }
  };

  // 开始游戏匹配
  const startMatch = async (agentId: string) => {
    setLoading(true);
    setCurrentAgentId(agentId);
    setErrorMessage(null);
    
    try {
        console.log(`[前端] 开始为 Agent ${agentId} 匹配游戏`);
        const response = await fetch('/api/game/startMatch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ agentId }),
        });
        const data = await response.json();
        console.log(`[前端] 匹配请求响应: ${JSON.stringify(data)}`);
        
        if (data.info.ok) {
            console.log(`[前端] 匹配请求成功，开始检查匹配状态`);
            setMatchStatus('in_matching_queue');
            setLoading(false);
            checkMatchStatus(agentId);
        } else {
            // 区分不同类型的错误
            if (data.info.code === 'ALREADY_IN_GAME') {
                api.warning({
                    message: 'Cannot match',
                    description: data.info.msg || 'Agent is already in matching or game'
                });
                setMatchStatus('idle');
            } else {
                api.error({
                    message: 'Match failed',
                    description: data.info.msg || 'Failed to start matching'
                });
                setMatchStatus('idle');
            }
            setCurrentAgentId(null);
            setLoading(false);
        }
    } catch (err) {
        console.error('开始匹配失败:', err);
        api.error({
            message: 'Match failed',
            description: 'Failed to start matching, please try again'
        });
        handleMatchError('Failed to start matching, please try again');
    }
  };

  // 取消匹配
  const cancelMatch = async () => {
    if (!currentAgentId) {
        api.error({
            message: 'Operation failed',
            description: 'No agent is currently matching'
        });
        return;
    }
    
    setLoading(true);
    
    try {
        // 先检查agent当前状态
        const checkResponse = await fetch(`/api/game/checkMatch?agentId=${currentAgentId}`);
        const checkData = await checkResponse.json();
        
        if (checkData.info.ok && checkData.data.gameStatus === 'idle') {
            setMatchStatus('idle');
            setCurrentAgentId(null);
            setLoading(false);
            api.info({
                message: 'Notice',
                description: 'Agent is no longer in the matching queue'
            });
            return;
        }
        
        const response = await fetch('/api/game/cancelMatch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ agentId: currentAgentId }),
        });
        
        const data = await response.json();
        if (data.info.ok) {
            api.success({
                message: 'Success',
                description: 'Matching has been canceled'
            });
            setMatchStatus('idle');
            setCurrentAgentId(null);
            setRoomId(null);
            setRoomData(null);
            await fetchAgents();
        } else {
            api.error({
                message: 'Error',
                description: data.info.msg || 'Failed to cancel matching'
            });
        }
    } catch (err) {
        console.error('取消匹配失败:', err);
        api.error({
            message: 'Operation failed',
            description: 'Failed to cancel matching, please try again'
        });
    } finally {
        setLoading(false);
    }
  };

  // 检查匹配状态
  const checkMatchStatus = async (agentId: string) => {
    if (!agentId || matchStatus !== 'in_matching_queue') return;

    try {
        console.log(`[前端] 检查 Agent ${agentId} 的匹配状态`);
        const response = await fetch(`/api/game/checkMatch?agentId=${agentId}`);
        const data = await response.json();
        
        if (data.info.ok) {
            const gameStatus = data.data.gameStatus as AgentGameStatus;
            console.log(`[前端] 匹配状态: ${gameStatus}, 房间ID: ${data.data.roomId}`);
            
            if (gameStatus === 'idle') {
                setMatchStatus('idle');
                setCurrentAgentId(null);
                setLoading(false);
                api.info({
                    message: 'Match ended',
                    description: 'Agent is no longer in the matching queue'
                });
                return;
            }
            
            if (gameStatus === 'inGame' && data.data.roomId) {
                setRoomId(data.data.roomId);
                setMatchStatus('inGame');
                fetchRoomData(data.data.roomId);
                api.info({
                    message: 'Match successful',
                    description: 'Agent has successfully matched to a game'
                });
            } else if (gameStatus === 'in_matching_queue') {
                api.info({
                    message: 'Matching',
                    description: 'Agent is still in the matching queue'
                });
                setTimeout(() => checkMatchStatus(agentId), 2000);
            }
        }
    } catch (err) {
        console.error('检查匹配状态失败:', err);
        api.error({
            message: 'Check match error',
            description: 'Failed to check match status'
        });
        setLoading(false);
        setMatchStatus('idle');
        setCurrentAgentId(null);
    }
  };

  // 处理匹配错误
  const handleMatchError = (errorMsg: string) => {
    setLoading(false);
    setErrorMessage(errorMsg);
    setTimeout(() => {
        setMatchStatus('idle');
        setCurrentAgentId(null);
        setErrorMessage(null);
    }, 2000);
  };

  // 获取房间数据
  const fetchRoomData = async (roomId: string) => {
    try {
      const response = await fetch('/api/game/getAgentRoomView', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId, agentId: currentAgentId })
      });
      const data = await response.json();
      if (data.info.ok) {
        setRoomData(data.data);
        setLoading(false);
        // 如果游戏还在进行中,继续轮询
        if (!data.data.endGameData) {
          setTimeout(() => fetchRoomData(roomId), 3000);
        }
      } else {
        throw new Error(data.info.msg || 'Failed to get room data');
      }
    } catch (err) {
      console.error('获取房间数据失败:', err);
      api.error({
        message: 'Fetch failed',
        description: 'Failed to get room data, please refresh the page and try again'
      });
      setLoading(false);
    }
  };

  // 添加定期状态同步
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (matchStatus === 'in_matching_queue' && currentAgentId) {
        intervalId = setInterval(async () => {
            try {
                const response = await fetch(`/api/game/checkMatch?agentId=${currentAgentId}`);
                const data = await response.json();
                
                if (data.info.ok) {
                    const gameStatus = data.data.gameStatus as AgentGameStatus;
                    console.log(`[前端] 检查到游戏状态: ${gameStatus}`);
                    
                    if (gameStatus === 'inGame' && data.data.roomId) {
                        setRoomId(data.data.roomId);
                        setMatchStatus('inGame');
                        fetchRoomData(data.data.roomId);
                    } else if (gameStatus === 'idle') {
                        setMatchStatus('idle');
                        setCurrentAgentId(null);
                        api.info({
                            message: 'Match ended',
                            description: 'Match has ended'
                        });
                    }
                }
            } catch (error) {
                console.error('State synchronization check failed:', error);
            }
        }, 2000);
    }
    
    return () => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    };
}, [matchStatus, currentAgentId]);

  useEffect(() => {
    fetchAgents();
  }, []);

  // 创建Agent
  const createAgent = async (values: { 
    agentId: string; 
    name: string; 
    avatar?: string;
    descriptionPrompt: string;
    votePrompt: string;
  }) => {
    try {
      const { agentId, name, avatar, descriptionPrompt, votePrompt } = values;
      const prompts = JSON.stringify({
        descriptionPrompt,
        votePrompt
      });

      const response = await fetch('/api/agent/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          name,
          avatar,
          prompts
        }),
      });
      const data = await response.json();
      
      if (data.info.ok) {
        api.success({
          message: 'Creation Successful',
          description: 'Agent created successfully'
        });
        setCreateModalVisible(false);
        createForm.resetFields();
        fetchAgents(); // 刷新列表
      } else {
        throw new Error(data.info.msg || 'Creation Failed');
      }
    } catch (err) {
      console.error('创建Agent失败:', err);
      api.error({
        message: 'Creation Failed',
        description: 'Failed to create Agent, please try again'
      });
    }
  };

  return (
    <div className="p-4">
        {contextHolder}
        <h1 className="text-2xl font-bold mb-4">Who is the Undercover Game</h1>
        
        {matchStatus === 'idle' && (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl">Select Agent to Start Game</h2>
                    <Button type="primary" onClick={() => setCreateModalVisible(true)}>
                        Create New Agent
                    </Button>
                </div>
                <List
                    grid={{ gutter: 16, column: 3 }}
                    dataSource={agents}
                    renderItem={(agent: WebAgent) => (
                        <List.Item>
                            <Card>
                                <Card.Meta
                                    avatar={<Avatar src={agent.avatar} />}
                                    title={agent.name}
                                    description={`Winning Rate: ${(agent.winningRate * 100).toFixed(1)}%`}
                                />
                                <Button
                                    type="primary"
                                    className="mt-4"
                                    onClick={() => startMatch(agent.agentId)}
                                    loading={loading && currentAgentId === agent.agentId}
                                    disabled={loading && currentAgentId !== agent.agentId}
                                >
                                    {loading && currentAgentId === agent.agentId ? 'Matching...' : 'Start Matching'}
                                </Button>
                            </Card>
                        </List.Item>
                    )}
                />

                <Modal
                    title="Create New Agent"
                    open={createModalVisible}
                    onCancel={() => setCreateModalVisible(false)}
                    footer={null}
                    width={800}
                >
                    <Form
                        form={createForm}
                        onFinish={createAgent}
                        layout="vertical"
                        initialValues={{
                            avatar: DEFAULT_AVATAR,
                            descriptionPrompt: `{history}
You are {name}, your vocabulary is {word}. You can guess other people's words, and you can directly state your guess.
Based on the game rules and previous conversations, please directly output your speech without stating your name (Note: your description should be concise and strictly mimic real human description syntax/punctuation.
Here are a few specific description examples: 1. Can also go down 2. Likes snakes 3. Essential for hot pot):`,
                            votePrompt: `{history}
You are {name}. Never vote for yourself {name}, and do not be misled by other agents, maintain your judgment, and judge the undercover based on the valid replies of other agents.
Choose the name of the person you think is the undercover from the list: {choices}, and then directly return the name:`
                        }}
                    >
                        <Form.Item
                            name="agentId"
                            label="Agent ID"
                            rules={[{ required: true, message: 'Please enter Agent ID' }]}
                        >
                            <Input placeholder="Please enter a unique Agent ID" />
                        </Form.Item>
                        <Form.Item
                            name="name"
                            label="Name"
                            rules={[{ required: true, message: 'Please enter Agent name' }]}
                        >
                            <Input placeholder="Please enter Agent name" />
                        </Form.Item>
                        <Form.Item
                            name="avatar"
                            label="Avatar URL"
                        >
                            <Input placeholder="Please enter Avatar URL (optional)" />
                        </Form.Item>
                        
                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                            <h3 className="text-lg font-medium mb-2">Prompt Configuration Instructions</h3>
                            <p className="text-sm text-gray-600 mb-2">Available placeholders:</p>
                            <ul className="list-disc list-inside text-sm text-gray-600 mb-4">
                                <li>{`{name}`} - Agent&apos;s name</li>
                                <li>{`{word}`} - The word assigned in the current game</li>
                                <li>{`{history}`} - Game history record</li>
                                <li>{`{choices}`} - List of players eligible for voting (only available in vote prompt)</li>
                            </ul>
                        </div>

                        <Form.Item
                            name="descriptionPrompt"
                            label="Description Prompt"
                            rules={[{ required: true, message: 'Please enter Description Prompt' }]}
                        >
                            <Input.TextArea
                                rows={6}
                                placeholder="Please enter Description Prompt"
                            />
                        </Form.Item>
                        <Form.Item
                            name="votePrompt"
                            label="Vote Prompt"
                            rules={[{ required: true, message: 'Please enter Vote Prompt' }]}
                        >
                            <Input.TextArea
                                rows={6}
                                placeholder="Please enter Vote Prompt"
                            />
                        </Form.Item>
                        <Form.Item>
                            <div className="flex justify-end gap-2">
                                <Button onClick={() => setCreateModalVisible(false)}>
                                    Cancel
                                </Button>
                                <Button type="primary" htmlType="submit">
                                    Create
                                </Button>
                            </div>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        )}

        {matchStatus === 'in_matching_queue' && (
            <div className="text-center">
                <Spin size="large" />
                <p className="mt-4">Matching in progress...</p>
                <p className="text-gray-500">Waiting for other players to join, or AI players will be automatically added</p>
                <p className="text-gray-500">The game will start under the following conditions:</p>
                <ul className="list-disc text-left inline-block mt-2">
                    <li>Number of players reaches 6</li>
                    <li>Or wait 10 seconds to automatically add AI players</li>
                </ul>
                <div className="mt-4 flex flex-col items-center gap-2">
                    <Button 
                        type="primary"
                        danger
                        onClick={cancelMatch}
                        loading={loading}
                        disabled={loading}
                    >
                        Cancel Matching
                    </Button>
                    {errorMessage && (
                        <p className="text-yellow-500 mt-2">{errorMessage}</p>
                    )}
                </div>
            </div>
        )}

        {matchStatus === 'inGame' && roomData && (
            <div>
                <h2 className="text-xl mb-4">Game Room #{roomId}</h2>
                <div className="grid grid-cols-2 gap-4">
                    <Card title="Player List">
                        <List
                            dataSource={roomData.initialPlayerList}
                            renderItem={(player: Player, index: number) => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={<Avatar src={player.avatar} />}
                                        title={`${player.mockName} (${player.agentName})`}
                                        description={roomData.currentStatusDescriptions[index]}
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                    <Card title="Game Information">
                        <p>Your word: {roomData.word}</p>
                        <div className="mt-4">
                            <h3 className="font-bold mb-2">Event List:</h3>
                            <List
                                dataSource={roomData.eventList}
                                renderItem={(event: GameEvent) => (
                                    <List.Item>
                                        {event.text || `${event.mockName} ${event.eventType}`}
                                    </List.Item>
                                )}
                            />
                        </div>
                    </Card>
                </div>
            </div>
        )}
    </div>
  );
}