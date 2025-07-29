import React, { useState, useEffect, useRef } from 'react'
import { 
  Send, 
  Plus, 
  Search, 
  Users, 
  MessageCircle, 
  Phone, 
  Video, 
  MoreVertical,
  Paperclip,
  Smile,
  X,
  User
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  is_active: boolean
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants: {
    user_id: string;
    last_read_at: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      photo_url?: string;
    }
  }[];
  messages: Message[];
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    photo_url?: string;
  }
}

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCurrentUser()
    loadUsers()
    loadConversations()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [])

  useEffect(() => {
    // Set up real-time subscription for messages
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          loadConversations() // Refresh conversation list
        })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser({ ...user, profile });
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  }

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('first_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadConversations = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's company_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Error loading profile:', profileError);
        return;
      }

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          type,
          title,
          created_by,
          created_at,
          updated_at,
          participants:conversation_participants!conversation_id(
            user_id,
            last_read_at,
            user:profiles!user_id(id, first_name, last_name, email, photo_url)
          )
        `)
        .eq('company_id', profile.company_id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading conversations:', error);
        return;
      }

      // For each conversation, load the messages
      const conversationsWithMessages = await Promise.all((data || []).map(async (conversation) => {
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, content, created_at, sender:profiles!sender_id(id, first_name, last_name, email, photo_url)')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error loading messages:', messagesError);
          return { ...conversation, messages: [] };
        }

        return { ...conversation, messages: messages || [] };
      }));

      setConversations(conversationsWithMessages);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  const markAsRead = async (conversationId: string) => {
    try {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUser?.id)
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    if (!selectedConversation) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: selectedConversation.id,
          sender_id: currentUser.id,
          content: newMessage
        }]);

      if (error) throw error;
      
      // Clear the message input
      setNewMessage('');
      
      // Reload the conversation to get the new message
      loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  const createConversation = async () => {
    if (selectedUsers.length === 0 || !currentUser) return

    setLoading(true);
    try {
      // Get current user's company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert([{
          company_id: profile.company_id,
          type: selectedUsers.length === 1 ? 'direct' : 'group',
          created_by: currentUser.id,
          title: selectedUsers.length > 1 ? 'Group Chat' : null
        }])
        .select()
        .single()

      if (convError) throw convError

      // Add participants (including current user)
      const participantIds = [...selectedUsers, currentUser.id]
      const participants = participantIds.map(userId => ({
        conversation_id: conversation.id,
        user_id: userId
      }))

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert(participants)

      if (participantsError) throw participantsError

      setShowNewConversation(false)
      setSelectedUsers([])
      loadConversations()
    } catch (error) {
      console.error('Error creating conversation:', error)
    } finally {
      setLoading(false);
    }
  }

  // Helper functions
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDate = (timestamp: string) => new Date(timestamp).toLocaleDateString()

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    
    // Search in conversation title
    if (conv.title?.toLowerCase().includes(searchLower)) return true
    
    // Search in participant names
    if (conv.participants.some(p => 
      `${p.user.first_name} ${p.user.last_name}`.toLowerCase().includes(searchLower) ||
      p.user.email.toLowerCase().includes(searchLower)
    )) return true
    
    // Search in messages
    if (conv.messages.some(m => m.content.toLowerCase().includes(searchLower))) return true
    
    return false
  })

  const filteredUsers = users.filter(user => 
    user.id !== currentUser?.id &&
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-white">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            <button
              onClick={() => setShowNewConversation(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {conversation.type === 'direct' 
                        ? (() => {
                            const otherParticipant = conversation.participants.find(p => p.user_id !== currentUser?.id);
                            if (otherParticipant?.user) {
                              const firstName = otherParticipant.user.first_name || '';
                              const lastName = otherParticipant.user.last_name || '';
                              return firstName && lastName ? `${firstName} ${lastName}` : 
                                     firstName ? firstName : 
                                     lastName ? lastName : 'Unknown User';
                            }
                            return 'Unknown User';
                          })()
                        : conversation.title || 'Group Chat'}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {conversation.messages.length > 0 
                        ? formatTime(conversation.messages[conversation.messages.length - 1].created_at) 
                        : formatDate(conversation.created_at)}
                    </span>
                  </div>
                  {conversation.messages.length > 0 && (
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.messages[conversation.messages.length - 1].content.substring(0, 50)}
                      {conversation.messages[conversation.messages.length - 1].content.length > 50 ? '...' : ''}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {conversation.participants.length} participants
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedConversation.type === 'direct' 
                        ? (() => {
                            const otherParticipant = selectedConversation.participants.find(p => p.user_id !== currentUser?.id);
                            if (otherParticipant?.user) {
                              const firstName = otherParticipant.user.first_name || '';
                              const lastName = otherParticipant.user.last_name || '';
                              return firstName && lastName ? `${firstName} ${lastName}` : 
                                     firstName ? firstName : 
                                     lastName ? lastName : 'Unknown User';
                            }
                            return 'Unknown User';
                          })()
                        : selectedConversation.title || 'Group Chat'}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center">
                      {selectedConversation.participants.length} participants
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Video className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex ${message.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                      message.sender_id === currentUser?.id 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.sender_id !== currentUser?.id && (
                      <p className="text-xs font-medium mb-1">
                        {message.sender?.first_name} {message.sender?.last_name}
                      </p>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 text-right ${
                      message.sender_id === currentUser?.id ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
              <p className="text-gray-500">Choose a conversation from the sidebar or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">New Conversation</h3>
                <button
                  onClick={() => setShowNewConversation(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      if (selectedUsers.includes(user.id)) {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                      } else {
                        setSelectedUsers([...selectedUsers, user.id])
                      }
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUsers.includes(user.id)
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {user.first_name[0]}{user.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowNewConversation(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createConversation}
                  disabled={selectedUsers.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Conversation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}