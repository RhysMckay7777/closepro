ADD DELETE BUTTON TO CALLS LIST + FIGURES CLEANUP

FEATURE 1: Delete Call from Calls List Page

On the calls list page (app/(dashboard)/dashboard/calls/page.tsx),
add a delete button/icon to each row in the calls table.

Implementation:

1. Add a trash icon button at the end of each row:

   import { Trash2 } from 'lucide-react';

   // In each table row, add a final cell:
   <td>
     <Button
       variant="ghost"
       size="sm"
       onClick={() => handleDeleteCall(call.id)}
       className="text-destructive hover:text-destructive"
     >
       <Trash2 className="h-4 w-4" />
     </Button>
   </td>

2. Add the delete handler:

   const handleDeleteCall = async (callId: string) => {
     if (!confirm('Are you sure you want to delete this call? This cannot be undone.')) {
       return;
     }
     try {
       const res = await fetch(`/api/calls/${callId}`, {
         method: 'DELETE',
       });
       if (!res.ok) throw new Error('Failed to delete');
       // Remove from local state to update UI immediately
       setCalls(prev => prev.filter(c => c.id !== callId));
       toast.success('Call deleted');
     } catch (err) {
       toast.error('Failed to delete call');
     }
   };

3. Add the "Actions" column header to the table:

   <th>Actions</th>

FEATURE 2: DELETE API Route

Create or update app/api/calls/[callId]/route.ts to handle 
DELETE requests:

   export async function DELETE(
     request: NextRequest,
     { params }: { params: { callId: string } }
   ) {
     const session = await auth();
     if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }

     const { callId } = params;

     // Verify the call belongs to this user
     const call = await db.query.salesCalls.findFirst({
       where: and(
         eq(salesCalls.id, callId),
         eq(salesCalls.userId, session.user.id)
       ),
     });

     if (!call) {
       return NextResponse.json({ error: 'Call not found' }, { status: 404 });
     }

     // Delete related data first (foreign key constraints)
     try {
       // Delete payment plan instalments
       await db.delete(paymentPlanInstalments)
         .where(eq(paymentPlanInstalments.salesCallId, callId));
     } catch { /* table may not exist */ }

     try {
       // Delete call analysis
       await db.delete(callAnalysis)
         .where(eq(callAnalysis.salesCallId, callId));
     } catch { /* may not exist */ }

     // Delete the call itself
     await db.delete(salesCalls)
       .where(eq(salesCalls.id, callId));

     return NextResponse.json({ success: true });
   }

   Import whatever schema tables are needed:
   import { salesCalls, callAnalysis, paymentPlanInstalments } from '@/db/schema';
   import { eq, and } from 'drizzle-orm';

IMPORTANT: Delete must cascade — remove instalments and 
analysis BEFORE deleting the parent salesCalls row, otherwise 
foreign key constraints will fail.

ALSO: Add a delete button on the call detail/analysis page too.
On app/(dashboard)/dashboard/calls/[callId]/page.tsx, add a 
delete button in the header area (next to the "Edit details" 
link):

   <Button
     variant="destructive"
     size="sm"
     onClick={async () => {
       if (!confirm('Delete this call and all its data?')) return;
       const res = await fetch(`/api/calls/${callId}`, { method: 'DELETE' });
       if (res.ok) {
         router.push('/dashboard/calls');
         toast.success('Call deleted');
       } else {
         toast.error('Failed to delete');
       }
     }}
   >
     <Trash2 className="h-4 w-4 mr-2" />
     Delete Call
   </Button>

BUILD AND DEPLOY.

VERIFY:
1. Calls list → each row has a trash icon
2. Click trash → "Are you sure?" confirmation dialog
3. Click confirm → call removed from list immediately
4. Figures page no longer shows that call's data
5. Call detail page also has a "Delete Call" button