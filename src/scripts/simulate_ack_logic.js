
// Simulation Script for Realtime Logic
// Run with: node simulate_orchestrator.js

const myUserId = 'user_A';

// Mock Data
const events = [
    { type: 'chat-update', payload: { action: 'typing', isTyping: true, conversationId: 'room1' } }, // SHOULD IGNORE
    { type: 'chat-update', payload: { action: 'message-deleted', messageId: 'msg1' } },           // SHOULD IGNORE
    { type: 'chat-update', payload: { id: 'msg2', content: 'Hello', sender_id: 'user_B' } },      // SHOULD ACK
    { type: 'chat-update', payload: { id: 'msg3', content: 'My Msg', sender_id: 'user_A' } },     // SHOULD IGNORE (Self)
    { type: 'new-message', payload: { message: { id: 'msg4', sender_id: 'user_B' } } }            // SHOULD ACK
];

function checkAck(event) {
    const data = event;
    const type = event.type;

    // Logic from Orchestrator
    const payload = data.payload || data;
    const message = payload.message || (payload.id && !payload.action ? payload : null);

    const isAckable = message?.id
        && !payload.action
        && !message.is_read
        && message.sender_id
        && message.sender_id !== myUserId;

    console.log(`Event [${type}] Payload keys: [${Object.keys(payload).join(', ')}] -> ACK? ${isAckable ? '✅ YES' : '❌ NO'} `);
    if (isAckable) console.log(`   -> Acking Message ID: ${message.id}`);
}

console.log('--- simulation start ---');
events.forEach(checkAck);
console.log('--- simulation end ---');
