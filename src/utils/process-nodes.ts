import { FlowDocument } from '@bebondy/package-models';

export class ProcessNodes {
  findEntryNode = (flow: FlowDocument) => {
    return flow.nodes.find((node) => node.type === 'ENTRY');
  };

  findCurrentNode = (flow: FlowDocument, currentNode?: string) => {
    return flow.nodes.find((node) => node.id === currentNode);
  };
}