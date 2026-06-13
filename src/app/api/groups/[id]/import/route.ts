import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseCsvContent } from '@/lib/import/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No CSV file uploaded' }, { status: 400 });
    }

    const csvText = await file.text();
    const filename = file.name;

    // Run Parsing and Validation Engine
    const report = parseCsvContent(csvText, filename);

    // Save Import Batch and Anomalies to DB in a Transaction
    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.importBatch.create({
        data: {
          groupId: id,
          importedById: session.userId,
          filename,
          status: 'pending',
          totalRows: report.totalRows,
          importedRows: report.importedRows,
          skippedRows: report.skippedRows,
          anomalyCount: report.anomalyCount,
          summary: JSON.stringify({
            filename: report.filename,
            totalRows: report.totalRows,
            importedRows: report.importedRows,
            skippedRows: report.skippedRows,
            anomalyCount: report.anomalyCount,
          }),
        }
      });

      // Save all detected anomalies
      for (const a of report.anomalies) {
        await tx.importAnomaly.create({
          data: {
            importBatchId: b.id,
            csvRowNumber: a.rowNumber,
            anomalyType: a.type,
            severity: a.severity,
            description: a.description,
            originalData: JSON.stringify(a.originalData),
            actionTaken: a.actionTaken,
            reviewStatus: 'pending',
          }
        });
      }

      return b;
    });

    return NextResponse.json({
      batchId: batch.id,
      report: {
        ...report,
        batchId: batch.id
      }
    });
  } catch (error) {
    console.error('Import CSV error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
