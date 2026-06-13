import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: {
            joinedAt: 'asc'
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Verify member is part of this group
    const isMember = group.memberships.some(m => m.userId === session.userId);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Fetch group details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, defaultCurrency, members } = await req.json();

    const group = await prisma.group.findUnique({
      where: { id },
      include: { memberships: true }
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Only admins or members can edit
    const isMember = group.memberships.some(m => m.userId === session.userId);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update group info
    const updatedGroup = await prisma.group.update({
      where: { id },
      data: {
        name: name || group.name,
        description: description !== undefined ? description : group.description,
        defaultCurrency: defaultCurrency || group.defaultCurrency,
      }
    });

    // If members timeline updates are passed
    if (members && Array.isArray(members)) {
      for (const m of members) {
        const { userId, joinedAt, leftAt, role } = m;
        
        await prisma.groupMembership.upsert({
          where: {
            groupId_userId: {
              groupId: id,
              userId
            }
          },
          update: {
            joinedAt: joinedAt ? new Date(joinedAt) : undefined,
            leftAt: leftAt ? new Date(leftAt) : null,
            role: role || undefined
          },
          create: {
            groupId: id,
            userId,
            joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
            leftAt: leftAt ? new Date(leftAt) : null,
            role: role || 'member'
          }
        });
      }
    }

    return NextResponse.json({ group: updatedGroup });
  } catch (error) {
    console.error('Update group details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
