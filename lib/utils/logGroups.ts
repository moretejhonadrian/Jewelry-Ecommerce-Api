// logGroups.ts
import { Stack } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';

export function getExistingLogGroup(stack: Stack, logicalId: string, lambdaName: string): logs.ILogGroup {
    return logs.LogGroup.fromLogGroupName(stack, logicalId, `/aws/lambda/${lambdaName}`);
}
