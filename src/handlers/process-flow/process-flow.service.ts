import {
  Types,
  LeadFlow,
  LeadFlowDocument,
  Logger,
  Flow,
  FlowDocument,
  SegmentLead,
} from '@bebondy/package-models';
import { Injectable } from '@nestjs/common';
import optimizelySdk from '@optimizely/optimizely-sdk';
import { ProcessNodes } from '../../utils/process-nodes';

@Injectable()
export class ProcessFlowService {
  public static readonly QUEUE_NODE_SEND_MAIL = 'flow-node-send-mail';
  public static readonly QUEUE_PROVIDER_SEND_MAIL_NAME = 'FLOW-NODE-SEND-MAIL';
  public static readonly QUEUE_NODE_WAIT = 'flow-node-wait';
  public static readonly QUEUE_NODE_WAIT_PROVIDER_NAME = 'FLOW-NODE-WAIT';
  public static readonly QUEUE_NODE_SEND_WHATSAPP = 'flow-node-send-whatsapp';
  public static readonly QUEUE_PROVIDER_SEND_WHATSAPP_NAME =
        'FLOW-NODE-SEND-WHATSAPP';
  public static readonly QUEUE_NODE_SEND_CAMPAIGN = 'flow-node-send-campaign';

  async getProcessFlowById(flowId: string) {
    const flow: FlowDocument = await Flow.findById(flowId).orFail();

    const filterLeadFlow: Record<string, any> = {
      flow: new Types.ObjectId(flowId),
      $or: [
        { waitDate: { $exists: false } },
        { waitDate: { $lt: new Date() } },
      ],
      // sendQueue: { $ne: true },
      optOut: { $ne: true },
      segmentOut: { $ne: true },
      currentNode: { $exists: true },
    };

    if (flow.annually) {
      delete filterLeadFlow.currentNode;
    }

    const featureDecision = await this.featureFlagDecision(
      flow.company._id,
      'flow_business_hours',
    );

    const page = 0;
    const limit = 10000;

    let leadsFlows = await LeadFlow.find(filterLeadFlow)
      .select('_id currentNode updatedAt lead')
      .sort({ _id: -1 })
      .limit(limit)
      .skip(page * limit)
      .exec();

    while (leadsFlows.length) {}
  }

  processLeadFlow = async (
    leadFlow: LeadFlowDocument[],
    flow: FlowDocument,
  ) => {
    const nodeEntry = new ProcessNodes().findEntryNode(flow);
    for (const leadFlowItem of leadFlow) {
      if (nodeEntry?.segments && nodeEntry?.segments.length > 0) {
        const flowSegments = nodeEntry.segments.map((segment) => segment);
        const segmentsLeads = await SegmentLead.find({
          lead: leadFlowItem.lead,
          segment: { $in: flowSegments },
        });
        if (!segmentsLeads.length) {
          leadFlowItem.segmentOut = true;
          await leadFlowItem.save();
          continue;
        }
      }
    }
  };

  featureFlagDecision = async (company: any, flag: string) => {
    await this.optimizelyClient()?.onReady();
    const user = this.optimizelyClient()?.createUserContext(
      company.toString(),
      {
        companyId: company.toString(),
      },
    );
    const decision = user?.decide(flag);
    return decision?.enabled;
  };

  optimizelyClient = () =>
    optimizelySdk.createInstance({
      sdkKey: process.env.OPTIMIZELY_KEY || '',
    });
}
