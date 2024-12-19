import { ClientProxy, RmqRecordBuilder, ClientProxyFactory, Transport, RmqContext } from '@nestjs/microservices';
import { LogEntry, logger } from '../logs/logs';
import * as amqp from 'amqplib';
import { AmqpConnectionManager } from 'amqp-connection-manager';

const MAX_RETRY = 5;
const PREFETCH_COUNT = 16;

class RabbitMQService {
	public connect(queue: string, connectionName: string) {
		const frameMax = 131072;
		const heartBeat = 60;
		const heartbeatIntervalInSeconds = 20;
		const reconnectTimeInSeconds = 60;
		const optionsUrl = `?frameMax=${frameMax}&heartbeat=${heartBeat}`;

		try {
			const provider = ClientProxyFactory.create({
				transport: Transport.RMQ,
				options: {
					urls: [
						`amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}${optionsUrl}`,
						`amqp://${process.env.RABBITMQ_USER_CLUSTER}:${process.env.RABBITMQ_PASSWORD_CLUSTER}@${process.env.RABBITMQ_HOST_CLUSTER}${optionsUrl}`,
						`amqp://${process.env.RABBITMQ_USER_CLUSTER2}:${process.env.RABBITMQ_PASSWORD_CLUSTER2}@${process.env.RABBITMQ_HOST_CLUSTER2}${optionsUrl}`,
					],
					queue,
					noAck: false,
					prefetchCount: PREFETCH_COUNT,
					queueOptions: {
						durable: true,
						heartbeatIntervalInSeconds: heartbeatIntervalInSeconds,
						reconnectTimeInSeconds: reconnectTimeInSeconds,
					},
					socketOptions: {
						clientProperties: {
							connection_name: connectionName + '-' + queue,
						},
					},
				},
			});

			return provider;
		} catch (error) {
			logger.error('Error connecting to RabbitMQ:' + error + ' queue:' + queue);
		}
	}

	public sendToQueue(provider: ClientProxy, queue: string, data: any, optionsHeader?: any): boolean {
		const logEntry = new LogEntry({});
		try {
			const record = this.recordBuilder(data, optionsHeader);
			provider.send({ cmd: queue }, record).toPromise();
			return true;
		} catch (error) {
			logEntry.error_message = error.message;
			logEntry.message_payload = data;
			logger.error(`Erro ao enviar messagem para a fila ${queue}`, logEntry);
			return false;
		}
	}

	/**
	 * Função que envia novamente a mensagem para a fila principal ou para a fila de erro
	 * @param context - Contexto da fila
	 * @param dataMessage - Mensagem da fila
	 * @param queueNameError - Nome da fila de erro
	 * @param queueProviderError - Provider da fila de erro
	 * @param logEntry - Objeto com as informações de log
	 * @param errorMessage - Mesangem de erro
	 */
	public Retry(
		context: RmqContext,
		dataMessage: any,
		queueNameError: string,
		queueProviderError: ClientProxy,
		logEntry: LogEntry,
		errorMessage?: string,
	) {
		try {
			const channel = context.getChannelRef();
			const originalMsg = context.getMessage();

			this.updateMessageHeader(originalMsg, errorMessage);

			//atingiu o máximo de tentativas, manda para a fila de erro
			if (this.verifyMaxRetry(originalMsg) == true) {
				this.sendToQueue(queueProviderError, queueNameError, dataMessage, originalMsg.properties.headers);

				//retira da fila principal
				channel.ack(originalMsg);

				logEntry.error_message = errorMessage;
				logEntry.message_payload = dataMessage;

				logger.info(`Enviando mensagem para a fila de erro ${queueNameError}`, logEntry);
			} else {
				//envia uma nova mensagem para a fila principal com o header atualizado e retira a mensagem original da fila
				if (channel.sendToQueue(originalMsg.fields.routingKey, originalMsg.content, originalMsg.properties) == true) {
					channel.ack(originalMsg);
				}
			}
		} catch (error) {
			throw new Error(error);
		}
	}

	public updateMessageHeader(message: any, error?: string) {
		try {
			const header = message.properties.headers;

			//Verifica se cada item do header existe, se não existir cria
			if (header && !header.retryCount) {
				header.retryCount = '0';
			}

			if (header && !header.retryMaxCount) {
				header.retryMaxCount = MAX_RETRY;
			}

			if (header && !header.error) {
				header.error = '';
			}

			header.retryCount = header && header.retryCount ? parseInt(header.retryCount) + 1 : 1;
			header.error = error;
		} catch (error) {
			console.log('Error updating message header:', error);
		}
	}

	public verifyMaxRetry(message: any) {
		try {
			const header = message.properties.headers;

			if (parseInt(header['retryCount']) >= parseInt(header['retryMaxCount'])) {
				return true;
			}
			return false;
		} catch (error) {
			console.log('Error verifying max retry:', error);
		}
	}

	private recordBuilder(data: any, optionsHeader?: any) {
		return new RmqRecordBuilder(data)
			.setOptions({
				headers: {
					...optionsHeader,
				},
				persistent: true,
				deliveryMode: 2,
				contentType: 'application/json',
				priority: 0,
			})
			.build();
	}

  /**
   * Cria uma conexão com o rabbitmq
   * @returns AmqpConnectionManager
	 * @param conectionName Nome da conexão
   * @throws Error
   */
	public async createConnection(conectionName: string) : Promise<AmqpConnectionManager> {
		try {			
			const connection = await amqp.connect(
				`amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}`, 
				{
					heartbeat: 60,
					frameMax: 131072,
					clientProperties: {
						connection_name: conectionName,
					},
				});				
			return connection;
		} catch (error) {
			throw new Error(`Erro ao criar conexão com o rabbitmq. ${error.message}`);
		}
	}

  /**
   * Cria um canal de comunicação com o rabbitmq
   * @param connection Conexão com o rabbitmq
   * @returns amqp.Channel
   * @throws Error
   */
  public async createChannel(connection: AmqpConnectionManager) : Promise<amqp.Channel> {
    try {
      const channel = await connection.createChannel();
      return channel;
    } catch (error) {
      throw new Error(`Erro ao criar canal com o rabbitmq. ${error.message}`);
    }
  }

  /**
   * Enceerra o canal de comunicação com o rabbitmq
   * @param channel - Canal de comunicação com o rabbitmq
   * @throws Error
   * @returns void
   */
  public async closeChannel(channel: amqp.Channel) {
    try {
      await channel.close();
    } catch (error) {
      throw new Error(`Erro ao fechar canal com o rabbitmq. ${error.message}`);
    }
  }

  /**
   * Encerra a conexão com o rabbitmq
   * @param connection  - Conexão com o rabbitmq   
   * @throws Error
   * @returns void
   */
  public async closeConnection(connection: AmqpConnectionManager) {
    try {
      await connection.close();
    } catch (error) {
      throw new Error(`Erro ao fechar conexão com o rabbitmq. ${error.message}`);
    }
  }
}

export default RabbitMQService;
