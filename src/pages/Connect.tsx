import { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  Heart,
  UserPlus,
  UserCheck,
  Search,
  Star,
  Send,
  ArrowRight,
  Eye,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Creator {
  id: string;
  name: string;
  avatar_url: string;
  tier: string;
  followers_count: number;
  bio: string;
  followed: boolean;
}

interface Connection {
  id: string;
  name: string;
  avatar_url: string;
  role: 'creator' | 'member';
  bio: string;
  isFollowing: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  timestamp: string;
  read: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export default function Connect() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'network' | 'messages'>('discover');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (user?.role === 'member') {
      loadCreators();
      loadConnections();
      loadMessages();
    }
  }, [user]);

  const loadCreators = async () => {
    try {
      setLoadingCreators(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, tier, followers_count, bio')
        .eq('account_type', 'creator')
        .limit(20);

      if (!error && data) {
        const creatorsWithFollowStatus = data.map((creator: any) => ({
          ...creator,
          followed: false,
        }));
        setCreators(creatorsWithFollowStatus);
      }
    } catch (error) {
      console.error('Error loading creators:', error);
      addToast('Failed to load creators', 'error');
    } finally {
      setLoadingCreators(false);
    }
  };

  const loadConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('member_connections')
        .select('id, connected_user_id, profiles:connected_user_id (id, name, avatar_url, account_type, bio)')
        .eq('member_id', user?.id)
        .limit(50);

      if (!error && data) {
        const connectionsList = data.map((conn: any) => ({
          id: conn.id,
          ...conn.profiles,
          isFollowing: true,
        }));
        setConnections(connectionsList);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, content, timestamp, read, sender:sender_id (name, avatar_url)')
        .eq('recipient_id', user?.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && data) {
        const messagesList = data.map((msg: any) => ({
          ...msg,
          sender_name: msg.sender?.name || 'Unknown',
          sender_avatar: msg.sender?.avatar_url || '',
        }));
        setMessages(messagesList);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleFollowCreator = async (creator: Creator) => {
    try {
      const { error } = await supabase.from('member_connections').insert({
        member_id: user?.id,
        connected_user_id: creator.id,
        connection_type: 'follow',
        created_at: new Date().toISOString(),
      });

      if (!error) {
        setCreators(
          creators.map((c) =>
            c.id === creator.id ? { ...c, followed: true } : c
          )
        );
        addToast(`Now following ${creator.name}`, 'success');
      }
    } catch (error) {
      console.error('Error following creator:', error);
      addToast('Failed to follow creator', 'error');
    }
  };

  const handleUnfollowCreator = async (creatorId: string) => {
    try {
      const { error } = await supabase
        .from('member_connections')
        .delete()
        .eq('member_id', user?.id)
        .eq('connected_user_id', creatorId);

      if (!error) {
        setCreators(
          creators.map((c) =>
            c.id === creatorId ? { ...c, followed: false } : c
          )
        );
        addToast('Unfollowed creator', 'success');
      }
    } catch (error) {
      console.error('Error unfollowing creator:', error);
      addToast('Failed to unfollow creator', 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConnection || !messageInput.trim()) return;

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user?.id,
        recipient_id: selectedConnection.id,
        content: messageInput,
        timestamp: new Date().toISOString(),
        read: false,
      });

      if (!error) {
        setMessageInput('');
        loadMessages();
        addToast('Message sent', 'success');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addToast('Failed to send message', 'error');
    }
  };

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, type, message };
    setToasts((prev) => [...prev, toast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const filteredCreators = creators.filter(
    (creator) =>
      creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.bio?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (user?.role !== 'member') {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto text-center py-20">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <p className="text-gray-300 text-lg">This feature is available for community members only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="mb-4">
            <h1 className="text-4xl font-playfair font-bold text-white">Connect</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Discover creators, build your network, and collaborate with the community.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          {(['discover', 'network', 'messages'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold transition-all capitalize ${
                activeTab === tab
                  ? 'text-rose-400 border-b-2 border-rose-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'discover' && (
                <>
                  <Eye className="w-4 h-4 inline mr-2" />
                  Discover
                </>
              )}
              {tab === 'network' && (
                <>
                  <Users className="w-4 h-4 inline mr-2" />
                  My Network
                </>
              )}
              {tab === 'messages' && (
                <>
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Messages
                </>
              )}
            </button>
          ))}
        </div>

        {/* Discover Tab */}
        {activeTab === 'discover' && (
          <div className="space-y-8">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search creators by name or bio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-rose-400 focus:bg-white/10"
              />
            </div>

            {/* Creator Grid */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Trending Creators</h2>
              {loadingCreators ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Loading creators...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCreators.length > 0 ? (
                    filteredCreators.map((creator) => (
                      <div
                        key={creator.id}
                        className="glass-effect rounded-2xl p-6 border border-white/10 hover:border-rose-400/50 transition-all group"
                      >
                        {/* Creator Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={creator.avatar_url || 'https://via.placeholder.com/48'}
                              alt={creator.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                            <div>
                              <h3 className="text-lg font-bold text-white">{creator.name}</h3>
                              <div className="flex items-center gap-1 text-xs text-yellow-400">
                                <Star className="w-3 h-3" />
                                {creator.tier?.charAt(0).toUpperCase() + creator.tier?.slice(1)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bio */}
                        <p className="text-sm text-gray-300 mb-4 line-clamp-2">
                          {creator.bio || 'Talented creator on FlourishTalents'}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center gap-4 mb-6 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{creator.followers_count || 0} followers</span>
                          </div>
                        </div>

                        {/* Action Button */}
                        {creator.followed ? (
                          <button
                            onClick={() => handleUnfollowCreator(creator.id)}
                            className="w-full py-2 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                          >
                            <UserCheck className="w-4 h-4" />
                            Following
                          </button>
                        ) : (
                          <button
                            onClick={() => handleFollowCreator(creator)}
                            className="w-full py-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 group-hover:shadow-rose-500/50"
                          >
                            <UserPlus className="w-4 h-4" />
                            Follow
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <p className="text-gray-400">No creators found matching your search.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-rose-400" />
                Your Connections ({connections.length})
              </h2>

              {connections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {connections.map((connection) => (
                    <div
                      key={connection.id}
                      className="glass-effect rounded-2xl p-6 border border-white/10 hover:border-rose-400/50 transition-all"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <img
                          src={connection.avatar_url || 'https://via.placeholder.com/48'}
                          alt={connection.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white">{connection.name}</h3>
                          <p className="text-xs text-gray-400 capitalize">{connection.role}</p>
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-rose-500/20 rounded text-xs text-rose-300 font-medium">
                            <Heart className="w-3 h-3" />
                            Following
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-gray-300 mb-4">
                        {connection.bio || 'Talented creator on FlourishTalents'}
                      </p>

                      <button
                        onClick={() => {
                          setSelectedConnection(connection);
                          setActiveTab('messages');
                        }}
                        className="w-full py-2 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Message
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 glass-effect rounded-2xl border border-white/10">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">You haven't followed anyone yet.</p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    Discover Creators
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Messages List */}
            <div className="lg:col-span-1">
              <h3 className="text-lg font-bold text-white mb-4">Recent Messages</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {messages.length > 0 ? (
                  messages.slice(0, 10).map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => {
                        const connection = connections.find((c) => c.id === msg.sender_id);
                        if (connection) setSelectedConnection(connection);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedConnection?.id === msg.sender_id
                          ? 'bg-rose-500/20 border border-rose-400/50'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={msg.sender_avatar || 'https://via.placeholder.com/32'}
                          alt={msg.sender_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{msg.sender_name}</p>
                          <p className="text-xs text-gray-400 truncate">{msg.content}</p>
                        </div>
                        {!msg.read && (
                          <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Message Thread */}
            <div className="lg:col-span-2">
              {selectedConnection ? (
                <div className="glass-effect rounded-2xl border border-white/10 p-6 h-96 flex flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
                    <img
                      src={selectedConnection.avatar_url || 'https://via.placeholder.com/40'}
                      alt={selectedConnection.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="font-bold text-white">{selectedConnection.name}</h4>
                      <p className="text-xs text-gray-400">Online</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                    {messages
                      .filter((m) => m.sender_id === selectedConnection.id)
                      .map((msg) => (
                        <div key={msg.id} className="flex gap-2">
                          <img
                            src={msg.sender_avatar}
                            alt={msg.sender_name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="bg-white/10 rounded-lg p-3 max-w-xs">
                            <p className="text-sm text-white">{msg.content}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-rose-400"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="p-2 bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-effect rounded-2xl border border-white/10 p-8 h-96 flex flex-col items-center justify-center">
                  <MessageSquare className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-400 text-center">Select a connection to start messaging</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 space-y-3 z-40">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-6 py-4 rounded-lg backdrop-blur-md border shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-500/20 border-green-400/50 text-green-100'
                : 'bg-red-500/20 border-red-400/50 text-red-100'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
